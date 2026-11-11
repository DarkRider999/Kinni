import SwiftUI
import PhotosUI

/// Encrypted vault grid. Import photos/videos via the system picker; they are
/// copied in encrypted and never re-exposed to the Photos library.
struct VaultView: View {
    @ObservedObject var vault: VaultStore
    let onBack: () -> Void

    @State private var picker: [PhotosPickerItem] = []
    @State private var viewing: VaultItem?

    private let cols = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        if let item = viewing {
            viewer(item)
        } else {
            grid
        }
    }

    private var grid: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: onBack) { Text("‹").font(.system(size: 28)).foregroundColor(Color(red: 0.208, green: 0.878, blue: 0.769)) }
                VStack(alignment: .leading) {
                    Text("Vault").font(.system(size: 22, weight: .bold)).foregroundColor(.white)
                    Text("\(vault.items.count) items · encrypted, hidden from Photos")
                        .font(.system(size: 12)).foregroundColor(Color(red: 0.4, green: 0.44, blue: 0.47))
                }.padding(.leading, 8)
                Spacer()
            }.padding(16)

            if vault.items.isEmpty {
                Spacer()
                Text("Nothing here yet.\nImport photos or videos.")
                    .multilineTextAlignment(.center).foregroundColor(.gray)
                Spacer()
            } else {
                ScrollView {
                    LazyVGrid(columns: cols, spacing: 8) {
                        ForEach(vault.items) { item in cell(item).onTapGesture { viewing = item } }
                    }.padding(8)
                }
            }

            PhotosPicker(selection: $picker, maxSelectionCount: 10, matching: .any(of: [.images, .videos])) {
                Text("Add photo/video").frame(maxWidth: .infinity).padding()
                    .background(Color(red: 0.208, green: 0.878, blue: 0.769)).foregroundColor(.black)
                    .cornerRadius(12)
            }.padding(16)
        }
        .background(Color(red: 0.043, green: 0.059, blue: 0.078).ignoresSafeArea())
        .onChange(of: picker) { _, newItems in importPicked(newItems) }
    }

    private func cell(_ item: VaultItem) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10).fill(Color(red: 0.086, green: 0.125, blue: 0.169))
            if item.isImage, let data = vault.open(item.id), let ui = UIImage(data: data) {
                Image(uiImage: ui).resizable().scaledToFill()
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                Text(item.isVideo ? "🎬" : "📄").font(.system(size: 28))
            }
        }.aspectRatio(1, contentMode: .fit)
    }

    private func viewer(_ item: VaultItem) -> some View {
        VStack {
            HStack {
                Button { viewing = nil } label: { Text("‹ Vault").foregroundColor(Color(red: 0.208, green: 0.878, blue: 0.769)) }
                Spacer()
                Button { vault.delete(item.id); viewing = nil } label: { Text("Delete").foregroundColor(.red) }
            }.padding(16)
            Spacer()
            if item.isImage, let data = vault.open(item.id), let ui = UIImage(data: data) {
                Image(uiImage: ui).resizable().scaledToFit()
            } else {
                VStack {
                    Text(item.isVideo ? "🎬" : "📄").font(.system(size: 64))
                    Text(item.name).foregroundColor(.white)
                    Text("\(item.sizeBytes / 1024) KB · \(item.mime)").font(.caption).foregroundColor(.gray)
                }
            }
            Spacer()
        }.background(Color.black.ignoresSafeArea())
    }

    private func importPicked(_ newItems: [PhotosPickerItem]) {
        for pi in newItems {
            pi.loadTransferable(type: Data.self) { result in
                if case .success(let data?) = result {
                    let mime = (pi.supportedContentTypes.first?.preferredMIMEType) ?? "application/octet-stream"
                    DispatchQueue.main.async { vault.add(data, name: "item", mime: mime) }
                }
            }
        }
        picker = []
    }
}
