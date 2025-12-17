import Foundation
import React

@objc(RecipeQueueManager)
class RecipeQueueManager: NSObject {

    static let appGroupIdentifier = "group.com.mauricio.lifeorganizer"
    static let queueKey = "queuedRecipeUrls"

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    /// Get all queued recipe URLs from App Group UserDefaults
    @objc
    func getQueuedUrls(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let sharedDefaults = UserDefaults(suiteName: RecipeQueueManager.appGroupIdentifier) else {
            reject("ERROR", "Failed to access App Group", nil)
            return
        }

        let urls = sharedDefaults.stringArray(forKey: RecipeQueueManager.queueKey) ?? []
        resolve(urls)
    }

    /// Remove a specific URL from the queue after processing
    @objc
    func removeUrl(_ url: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let sharedDefaults = UserDefaults(suiteName: RecipeQueueManager.appGroupIdentifier) else {
            reject("ERROR", "Failed to access App Group", nil)
            return
        }

        var urls = sharedDefaults.stringArray(forKey: RecipeQueueManager.queueKey) ?? []
        urls.removeAll { $0 == url }

        sharedDefaults.set(urls, forKey: RecipeQueueManager.queueKey)

        resolve(true)
    }

    /// Clear the entire recipe URL queue
    @objc
    func clearQueue(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let sharedDefaults = UserDefaults(suiteName: RecipeQueueManager.appGroupIdentifier) else {
            reject("ERROR", "Failed to access App Group", nil)
            return
        }

        sharedDefaults.removeObject(forKey: RecipeQueueManager.queueKey)

        resolve(true)
    }
}
