import Foundation
import React
import WidgetKit

@objc(WidgetDataManager)
class WidgetDataManager: NSObject {
  
  static let appGroupIdentifier = "group.com.mauricio.lifeorganizer"
  static let widgetDataKey = "widgetData"
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func setWidgetData(_ data: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = UserDefaults(suiteName: WidgetDataManager.appGroupIdentifier) else {
      reject("ERROR", "Failed to access App Group", nil)
      return
    }
    
    sharedDefaults.set(data, forKey: WidgetDataManager.widgetDataKey)
    sharedDefaults.synchronize()
    
    // Notify widget to reload
    WidgetCenter.shared.reloadAllTimelines()
    
    resolve(true)
  }
  
  @objc
  func getWidgetData(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let sharedDefaults = UserDefaults(suiteName: WidgetDataManager.appGroupIdentifier),
          let data = sharedDefaults.string(forKey: WidgetDataManager.widgetDataKey) else {
      reject("ERROR", "No widget data found", nil)
      return
    }
    
    resolve(data)
  }
}

// Bridge module
@objc(WidgetDataManager)
class WidgetDataManagerModule: RCTBridgeModule {
  
  static func moduleName() -> String! {
    return "WidgetDataManager"
  }
  
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}

