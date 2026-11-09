// Face ID / Touch ID con ripiego sul codice del telefono (LocalAuthentication).
#import <React/RCTBridgeModule.h>
#import <LocalAuthentication/LocalAuthentication.h>

@interface Biometrics : NSObject <RCTBridgeModule>
@end

@implementation Biometrics

RCT_EXPORT_MODULE(Biometrics)

+ (BOOL)requiresMainQueueSetup { return NO; }

// "faceID", "touchID", "opticID", "passcode" (solo codice) oppure "none" (nessun blocco impostato).
RCT_EXPORT_METHOD(kind:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  LAContext *ctx = [LAContext new];
  NSError *err = nil;
  if ([ctx canEvaluatePolicy:LAPolicyDeviceOwnerAuthenticationWithBiometrics error:&err]) {
    switch (ctx.biometryType) {
      case LABiometryTypeFaceID: resolve(@"faceID"); return;
      case LABiometryTypeTouchID: resolve(@"touchID"); return;
      default: break;
    }
    if (@available(iOS 17.0, *)) {
      if (ctx.biometryType == LABiometryTypeOpticID) { resolve(@"opticID"); return; }
    }
  }
  resolve([ctx canEvaluatePolicy:LAPolicyDeviceOwnerAuthentication error:nil] ? @"passcode" : @"none");
}

// Risolve: "ok", "cancel" (annullato dall'utente o dal sistema), "unavailable" (nessun blocco
// impostato sul telefono) oppure "failed".
RCT_EXPORT_METHOD(authenticate:(NSString *)reason
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  LAContext *ctx = [LAContext new];
  ctx.localizedFallbackTitle = @"Usa codice";
  ctx.localizedCancelTitle = @"Annulla";
  NSError *err = nil;
  // DeviceOwnerAuthentication = biometria, e se non va il codice del telefono.
  if (![ctx canEvaluatePolicy:LAPolicyDeviceOwnerAuthentication error:&err]) {
    resolve(@"unavailable");
    return;
  }
  [ctx evaluatePolicy:LAPolicyDeviceOwnerAuthentication
      localizedReason:reason
                reply:^(BOOL success, NSError *error) {
    if (success) { resolve(@"ok"); return; }
    switch (error.code) {
      case LAErrorUserCancel:
      case LAErrorSystemCancel:
      case LAErrorAppCancel:
        resolve(@"cancel"); return;
      case LAErrorPasscodeNotSet:
        resolve(@"unavailable"); return;
      default:
        resolve(@"failed"); return;
    }
  }];
}

@end
