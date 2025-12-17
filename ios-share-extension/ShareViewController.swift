import UIKit
import UniformTypeIdentifiers
import UserNotifications

class ShareViewController: UIViewController {

    static let appGroupIdentifier = "group.com.mauricio.lifeorganizer"
    static let queueKey = "queuedRecipeUrls"

    private let containerView: UIView = {
        let view = UIView()
        view.backgroundColor = UIColor.systemBackground
        view.layer.cornerRadius = 16
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()

    private let iconImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.image = UIImage(named: "AppIcon")
        imageView.contentMode = .scaleAspectFit
        imageView.layer.cornerRadius = 12
        imageView.clipsToBounds = true
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()

    private let statusLabel: UILabel = {
        let label = UILabel()
        label.text = "Recipe queued!"
        label.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        label.textColor = .label
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private let subtitleLabel: UILabel = {
        let label = UILabel()
        label.text = "Open the app to save it"
        label.font = UIFont.systemFont(ofSize: 14, weight: .regular)
        label.textColor = .secondaryLabel
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        handleSharedContent()
    }

    private func setupUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.4)

        view.addSubview(containerView)
        containerView.addSubview(iconImageView)
        containerView.addSubview(statusLabel)
        containerView.addSubview(subtitleLabel)

        NSLayoutConstraint.activate([
            containerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            containerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            containerView.widthAnchor.constraint(equalToConstant: 200),
            containerView.heightAnchor.constraint(equalToConstant: 160),

            iconImageView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 20),
            iconImageView.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            iconImageView.widthAnchor.constraint(equalToConstant: 50),
            iconImageView.heightAnchor.constraint(equalToConstant: 50),

            statusLabel.topAnchor.constraint(equalTo: iconImageView.bottomAnchor, constant: 12),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),

            subtitleLabel.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 4),
            subtitleLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            subtitleLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
        ])
    }

    private func handleSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            showError("No content to share")
            return
        }

        for item in extensionItems {
            guard let attachments = item.attachments else { continue }

            for attachment in attachments {
                // Handle URLs
                if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, error) in
                        if let error = error {
                            self?.showError("Failed to load shared content")
                            return
                        }
                        if let url = data as? URL {
                            self?.processURL(url)
                        } else if let urlData = data as? Data, let url = URL(dataRepresentation: urlData, relativeTo: nil) {
                            self?.processURL(url)
                        } else {
                            self?.showError("Could not extract URL")
                        }
                    }
                    return
                }

                // Handle plain text (might contain URL)
                if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (data, error) in
                        if let error = error {
                            self?.showError("Failed to load shared content")
                            return
                        }
                        if let text = data as? String, let url = URL(string: text), url.scheme == "https" || url.scheme == "http" {
                            self?.processURL(url)
                        } else {
                            self?.showError("No valid URL found in text")
                        }
                    }
                    return
                }
            }
        }

        showError("No URL found")
    }

    private func processURL(_ url: URL) {
        let urlString = url.absoluteString

        // Validate Instagram URL (optional but recommended)
        let isInstagramURL = urlString.contains("instagram.com") || urlString.contains("instagr.am")

        if !isInstagramURL {
            DispatchQueue.main.async {
                self.showError("Only Instagram links are supported")
            }
            return
        }

        // Check for duplicates and add to queue
        if addToQueue(urlString) {
            sendQueuedNotification()
            DispatchQueue.main.async {
                self.statusLabel.text = "Recipe queued!"
                self.subtitleLabel.text = "Open the app to save it"
            }

            // Auto-dismiss after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                self.closeExtension()
            }
        } else {
            DispatchQueue.main.async {
                self.statusLabel.text = "Already queued"
                self.subtitleLabel.text = "This recipe is already in your queue"
            }

            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                self.closeExtension()
            }
        }
    }

    private func addToQueue(_ urlString: String) -> Bool {
        guard let sharedDefaults = UserDefaults(suiteName: ShareViewController.appGroupIdentifier) else {
            return false
        }

        // Load existing queue
        var queue = sharedDefaults.stringArray(forKey: ShareViewController.queueKey) ?? []

        // Check for duplicates
        if queue.contains(urlString) {
            return false
        }

        // Add to queue
        queue.append(urlString)

        // Save back
        sharedDefaults.set(queue, forKey: ShareViewController.queueKey)

        return true
    }

    private func sendQueuedNotification() {
        let content = UNMutableNotificationContent()
        content.title = "Recipe queued"
        content.body = "Open Life Organizer to save this recipe"
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil // Immediate
        )

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Failed to send notification: \(error)")
            }
        }
    }

    private func showError(_ message: String) {
        DispatchQueue.main.async {
            self.statusLabel.text = "Error"
            self.subtitleLabel.text = message
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.closeExtension()
        }
    }

    private func closeExtension() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
