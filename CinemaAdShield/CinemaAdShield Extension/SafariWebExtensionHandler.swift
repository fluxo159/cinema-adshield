import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        // Native commands are not needed; never log or echo browser data.
        context.completeRequest(returningItems: [], completionHandler: nil)
    }
}
