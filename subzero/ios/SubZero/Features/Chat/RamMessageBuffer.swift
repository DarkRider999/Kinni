import Foundation
import Combine

enum MessageDirection { case inbound, outbound }

struct Message: Identifiable, Equatable {
    let id = UUID()
    let conversationId: String
    let direction: MessageDirection
    var body: String
    let timestamp = Date()
    var expiresAt: Date?
}

/// In-memory message store. Nothing is written to disk. Publishes changes for
/// SwiftUI. Evicts disappearing messages and zeroes state on `wipeAll()`
/// (secure logout / SafeZone auto-lock / user-initiated wipe).
final class RamMessageBuffer: ObservableObject {
    @Published private(set) var conversations: [String: [Message]] = [:]
    private let maxPerConversation = 500

    func add(_ message: Message) {
        var list = conversations[message.conversationId] ?? []
        list.append(message)
        if list.count > maxPerConversation { list.removeFirst(list.count - maxPerConversation) }
        conversations[message.conversationId] = list
    }

    func messages(_ conversationId: String) -> [Message] {
        evictExpired()
        return conversations[conversationId] ?? []
    }

    func evictExpired() {
        let now = Date()
        for (key, list) in conversations {
            let filtered = list.filter { ($0.expiresAt ?? .distantFuture) > now }
            if filtered.count != list.count { conversations[key] = filtered }
        }
    }

    /// Clears one conversation from view (SafeZone activation).
    func clearConversationView(_ conversationId: String) { conversations[conversationId] = [] }

    /// Drops all content (secure logout / auto-lock).
    func wipeAll() { conversations.removeAll() }
}
