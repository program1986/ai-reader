// Apple Sign In - iOS 原生端
// 流程:
// 1. JS 端 invoke('sign_in_with_apple')
// 2. Rust 命令 emit "apple-signin-start" 事件
// 3. 本类在 AppDelegate 中已注册,收到事件后启动 ASAuthorization
// 4. 完成 / 取消 / 失败后 invoke('complete_apple_signin') 把结果送回 Rust
//
// 集成步骤(在 Xcode 工程里):
// 1. `pnpm tauri ios init` 生成 Xcode 工程(只需做一次)
// 2. 把本文件拖到 Xcode 工程的 ai_reader target 里
// 3. 在 AppDelegate.swift / TauriApp 入口处:
//      AppleSignIn.shared.attach()
//    并在 application(_:didFinishLaunchingWithOptions:) 末尾调用
// 4. 确认 Signing & Capabilities 里有 "Sign In with Apple" capability
//    (Info.plist 已声明,见 com.apple.developer.applesignin)
//
// 真机验证清单(需要在真机跑):
// - iOS 15+ 真机
// - Apple ID 已登录 Settings
// - 模拟器不支持 Sign In with Apple(ASAuthorizationError.unsupported)
//
// 注意:Tauri 2 iOS 桥的 invoke API 在不同小版本可能略有差异,若编译报
// "no member named invoke" / "cannot find TauriApp" 之类的错,按 Xcode 提示改 API 调用方式即可

import Foundation
import AuthenticationServices
import UIKit

#if canImport(Tauri)
import Tauri
#endif

@objc(AppleSignIn)
public final class AppleSignIn: NSObject {

    @objc public static let shared = AppleSignIn()

    private var tauriRef: AnyObject?
    private var startListenerId: UInt32 = 0

    private override init() {
        super.init()
    }

    /// 注入 Tauri app 引用并注册 start 事件监听
    /// 在 AppDelegate / SceneDelegate 中调用一次
    @objc public func attach(tauri: AnyObject) {
        self.tauriRef = tauri
        registerStartListener()
    }

    /// 启动 ASAuthorization
    @objc public func start() {
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    // MARK: - 内部:事件监听

    private func registerStartListener() {
        // Tauri 2 iOS 桥的事件监听 API
        // 若该 API 不可用,改成直接用 callback 启动(由 Rust emit 改为 Rust invoke 一个
        // 只在 native 端可用的 command) - 详见 ios.rs 注释
        guard let tauri = tauriRef else { return }
        let startSel = NSSelectorFromString("listen:handler:")
        if tauri.responds(to: startSel) {
            // swiftlint:disable:next line_length
            _ = tauri.perform(startSel, with: "apple-signin-start", with: { [weak self] (_: Any) in
                self?.start()
            })
        } else {
            // 备选:用 tauri.invoke(...) 启动
            // 这里走"前端 emit + 入口已在前端"路线时不需要
            // 真机调试时如果 listen 不可用,改成:Swift 不监听,改由前端在调用
            // sign_in_with_apple 之后,setTimeout(0) 主动 invoke('apple_signin_native_start')
            // 由这个 native command 直接调 self.start()
            NSLog("[AppleSignIn] Tauri.listen API not found; 请按 ios.rs 注释调整")
        }
    }

    // MARK: - 把结果送回 Rust

    private func sendOutcome(_ outcome: [String: Any]) {
        guard let tauri = tauriRef else { return }
        let sel = NSSelectorFromString("invoke:arguments:callback:")
        if tauri.responds(to: sel) {
            // 异步调用,无返回
            _ = tauri.perform(
                sel,
                with: "complete_apple_signin",
                with: ["outcome": outcome]
            )
        } else {
            // 备选 API 名称
            let alt = NSSelectorFromString("invoke:args:completion:")
            if tauri.responds(to: alt) {
                _ = tauri.perform(alt, with: "complete_apple_signin", with: ["outcome": outcome])
            } else {
                NSLog("[AppleSignIn] Tauri.invoke API not found")
            }
        }
    }
}

// MARK: - ASAuthorizationControllerDelegate

extension AppleSignIn: ASAuthorizationControllerDelegate {

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            sendOutcome([
                "status": "failed",
                "code": "invalid_credential",
                "message": "Not an Apple ID credential",
            ])
            return
        }

        let identityToken = credential.identityToken
            .flatMap { String(data: $0, encoding: .utf8) } ?? ""

        let name: String? = {
            guard let full = credential.fullName else { return nil }
            if let given = full.givenName, let family = full.familyName, !given.isEmpty, !family.isEmpty {
                return "\(given) \(family)"
            }
            if let given = full.givenName, !given.isEmpty {
                return given
            }
            return nil
        }()

        var outcome: [String: Any] = [
            "status": "success",
            "user_id": credential.user,
            "identity_token": identityToken,
        ]
        outcome["name"] = name ?? NSNull()
        outcome["email"] = credential.email ?? NSNull()

        sendOutcome(outcome)
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        let nsError = error as NSError
        if nsError.domain == ASAuthorizationErrorDomain,
           nsError.code == ASAuthorizationError.canceled.rawValue {
            sendOutcome(["status": "cancelled"])
            return
        }
        sendOutcome([
            "status": "failed",
            "code": "auth_error",
            "message": error.localizedDescription,
        ])
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding

extension AppleSignIn: ASAuthorizationControllerPresentationContextProviding {

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        // 找到当前 key window
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            if let key = windowScene.windows.first(where: { $0.isKeyWindow }) {
                return key
            }
            if let first = windowScene.windows.first {
                return first
            }
        }
        return ASPresentationAnchor()
    }
}
