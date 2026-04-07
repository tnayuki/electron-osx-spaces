#import <Cocoa/Cocoa.h>
#import <napi.h>

// NSKeyedArchiverDelegate to skip objects that cannot be securely encoded
// (NSWindow itself, NSViews such as Electron's BridgedContentView).
@interface SpacesArchiverDelegate : NSObject <NSKeyedArchiverDelegate>
@property(nonatomic, assign) NSWindow* window;
@end

@implementation SpacesArchiverDelegate

- (id)archiver:(NSKeyedArchiver*)archiver willEncodeObject:(id)object {
    if (object == self.window)
        return nil;
    if ([object isKindOfClass:[NSView class]])
        return nil;
    return object;
}

@end

// macOS 15 workaround for Space restoration (FB15644170).
// Override _windowRestorationOptions to return a default-initialized value,
// which tells AppKit to restore windows to their original Space.
//
// On macOS 14 and earlier, NSWindowRestoresWorkspaceAtLaunch UserDefault
// controls this behavior instead.
@interface SpacesKeyedUnarchiver : NSKeyedUnarchiver
@property(nonatomic) BOOL shouldRestoreSpace;
@end

@implementation SpacesKeyedUnarchiver

- (id)_windowRestorationOptions {
    if (self.shouldRestoreSpace) {
        return [[NSClassFromString(@"NSWindowRestorationOptions") alloc] init];
    }
    return nil;
}

@end

static NSWindow* GetNSWindow(Napi::Value handle) {
    auto buf = handle.As<Napi::Buffer<uint8_t>>();
    NSView* view = *reinterpret_cast<NSView* __strong*>(buf.Data());
    return [view window];
}

// Encode the window's restorable state (frame + Space info) into a Buffer.
// Uses NSKeyedArchiverDelegate to skip NSView objects that don't adopt
// NSSecureCoding.
Napi::Value EncodeState(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBuffer()) {
        Napi::TypeError::New(env, "Expected native window handle (Buffer)")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    NSWindow* win = GetNSWindow(info[0]);
    if (!win) {
        Napi::Error::New(env, "Could not get NSWindow from handle")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    @try {
        NSKeyedArchiver* encoder =
            [[NSKeyedArchiver alloc] initRequiringSecureCoding:YES];
        SpacesArchiverDelegate* delegate =
            [[SpacesArchiverDelegate alloc] init];
        delegate.window = win;
        encoder.delegate = delegate;

        [win encodeRestorableStateWithCoder:encoder];
        [encoder finishEncoding];
        NSData* data = encoder.encodedData;

        return Napi::Buffer<uint8_t>::Copy(
            env,
            static_cast<const uint8_t*>(data.bytes),
            data.length);
    } @catch (NSException* exception) {
        Napi::Error::New(
            env,
            std::string("encodeRestorableState failed: ") +
                exception.reason.UTF8String)
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }
}

// Restore the window's state (frame + Space) from a previously encoded Buffer.
Napi::Value RestoreState(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsBuffer() || !info[1].IsBuffer()) {
        Napi::TypeError::New(
            env, "Expected (nativeHandle: Buffer, stateData: Buffer)")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    bool restoreSpace = true;
    if (info.Length() >= 3 && info[2].IsObject()) {
        auto opts = info[2].As<Napi::Object>();
        if (opts.Has("restoreSpace")) {
            restoreSpace = opts.Get("restoreSpace").ToBoolean().Value();
        }
    }

    NSWindow* win = GetNSWindow(info[0]);
    if (!win) {
        Napi::Error::New(env, "Could not get NSWindow from handle")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    auto buf = info[1].As<Napi::Buffer<uint8_t>>();
    NSData* data = [NSData dataWithBytes:buf.Data() length:buf.Length()];

    @try {
        NSError* error = nil;
        SpacesKeyedUnarchiver* decoder =
            [[SpacesKeyedUnarchiver alloc] initForReadingFromData:data
                                                           error:&error];
        if (error) {
            Napi::Error::New(
                env,
                std::string("Failed to create unarchiver: ") +
                    error.localizedDescription.UTF8String)
                .ThrowAsJavaScriptException();
            return env.Undefined();
        }

        decoder.shouldRestoreSpace = restoreSpace;

        // On macOS < 15, NSWindowRestoresWorkspaceAtLaunch UserDefault
        // controls Space restoration. On macOS 15+, that UserDefault is
        // broken (FB15644170, still unfixed as of macOS 26), so
        // _windowRestorationOptions override is used instead.
        if (restoreSpace) {
            if (@available(macOS 15, *)) {
                // _windowRestorationOptions override handles this
            } else {
                [NSUserDefaults.standardUserDefaults registerDefaults:@{
                    @"NSWindowRestoresWorkspaceAtLaunch" : @YES
                }];
            }
        }

        [win restoreStateWithCoder:decoder];
    } @catch (NSException* exception) {
        Napi::Error::New(
            env,
            std::string("restoreStateWithCoder failed: ") +
                exception.reason.UTF8String)
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("encodeState", Napi::Function::New(env, EncodeState));
    exports.Set("restoreState", Napi::Function::New(env, RestoreState));
    return exports;
}

NODE_API_MODULE(spaces, Init)
