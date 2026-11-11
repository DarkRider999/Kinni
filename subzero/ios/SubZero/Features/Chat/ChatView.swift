import SwiftUI

final class ChatViewModel: ObservableObject {
    @Published var draft = ""
    @Published var disappearingSeconds = 0
    let conversationId: String
    private let buffer: RamMessageBuffer

    init(conversationId: String, buffer: RamMessageBuffer) {
        self.conversationId = conversationId
        self.buffer = buffer
    }

    /// Sends via the crypto/transport layer. Wired to ChatRepository in the app
    /// assembly; here it appends to the RAM buffer for the UI to render.
    func send() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        let expiry = disappearingSeconds > 0
            ? Date().addingTimeInterval(TimeInterval(disappearingSeconds)) : nil
        buffer.add(Message(conversationId: conversationId, direction: .outbound,
                           body: text, expiresAt: expiry))
        draft = ""
    }
}

struct ChatView: View {
    @ObservedObject var viewModel: ChatViewModel
    @ObservedObject var buffer: RamMessageBuffer
    let onSafeZone: () -> Void
    var onVoiceCall: () -> Void = {}
    var onVideoCall: () -> Void = {}
    var onOpenVault: () -> Void = {}

    private let ink = Color(red: 0.043, green: 0.059, blue: 0.078)
    private let neon = Color(red: 0.208, green: 0.878, blue: 0.769)

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("SubZero").foregroundColor(.white)
                Spacer()
                topAction("phone.fill", onVoiceCall)
                topAction("video.fill", onVideoCall)
                topAction("lock.rectangle.stack.fill", onOpenVault)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(Color(red: 0.067, green: 0.094, blue: 0.122))
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(buffer.messages(viewModel.conversationId)) { msg in
                        bubble(msg)
                    }
                }.padding(12)
            }
            HStack(spacing: 8) {
                // SafeZone button disguised as a neutral accessory icon.
                Button(action: onSafeZone) {
                    Image(systemName: "circle.circle")
                        .foregroundColor(neon).frame(width: 40, height: 40)
                }
                TextField("Message", text: $viewModel.draft)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit(viewModel.send)
                Button("Send", action: viewModel.send).tint(neon)
            }.padding(8)
        }
        .background(ink.ignoresSafeArea())
    }

    private func topAction(_ system: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system).foregroundColor(neon)
                .frame(width: 36, height: 36).background(Color(red: 0.086, green: 0.125, blue: 0.169))
                .clipShape(Circle())
        }.padding(.leading, 10)
    }

    private func bubble(_ msg: Message) -> some View {
        HStack {
            if msg.direction == .outbound { Spacer() }
            Text(msg.body)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(msg.direction == .outbound
                            ? Color(red: 0.11, green: 0.48, blue: 0.43)
                            : Color(red: 0.106, green: 0.145, blue: 0.188))
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            if msg.direction == .inbound { Spacer() }
        }
    }
}
