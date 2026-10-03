import SwiftUI

/// A believable Notes decoy. Notes are in-memory only (a disguise, not storage).
/// Browse, open, edit, and add — enough to pass a glance. Yellow theme matches
/// the Notes disguise icon.
private struct DecoyNote: Identifiable {
    let id = UUID()
    var title: String
    var body: String
    var time: String
}

struct NotesView: View {
    @State private var notes: [DecoyNote] = [
        .init(title: "Groceries", body: "Milk, eggs, coffee, olive oil, spinach, pasta, tomatoes", time: "9:24 AM"),
        .init(title: "Weekend", body: "Trail hike Saturday, brunch Sunday with the Patels", time: "Yesterday"),
        .init(title: "Gift ideas", body: "Headphones, that jacket she liked, weekend trip?", time: "Mon"),
        .init(title: "Books", body: "Project Hail Mary, The Overstory, Educated", time: "Sun"),
        .init(title: "Wifi", body: "Guest network password is sunflower-42", time: "Aug 3"),
    ]
    @State private var editingIndex: Int?

    private let yellow = Color(red: 0.969, green: 0.808, blue: 0.275)

    var body: some View {
        if let i = editingIndex, notes.indices.contains(i) {
            NoteEditor(note: $notes[i]) { editingIndex = nil }
        } else {
            list
        }
    }

    private var list: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Notes").font(.system(size: 30, weight: .bold)).foregroundColor(Color(red: 0.16, green: 0.14, blue: 0))
                Spacer()
                Text("\(notes.count) notes").font(.footnote).foregroundColor(Color(red: 0.42, green: 0.35, blue: 0))
            }
            .padding(.horizontal, 20).padding(.vertical, 18).frame(maxWidth: .infinity).background(yellow)

            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(notes.indices, id: \.self) { i in
                        Button { editingIndex = i } label: { row(notes[i]) }.buttonStyle(.plain)
                    }
                }.padding(12)
            }

            HStack {
                Spacer()
                Button {
                    notes.insert(.init(title: "New note", body: "", time: "now"), at: 0)
                    editingIndex = 0
                } label: {
                    Image(systemName: "plus").font(.system(size: 26, weight: .bold))
                        .foregroundColor(Color(red: 0.16, green: 0.14, blue: 0))
                        .frame(width: 58, height: 58).background(yellow).clipShape(Circle())
                }.padding(20)
            }
        }
        .background(Color(red: 0.078, green: 0.09, blue: 0.11).ignoresSafeArea())
    }

    private func row(_ n: DecoyNote) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(n.title).font(.system(size: 18, weight: .semibold)).foregroundColor(.white)
            HStack {
                Text(n.time).font(.caption).foregroundColor(Color(red: 0.9, green: 0.65, blue: 0))
                Text(n.body).font(.caption).foregroundColor(.gray).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16).background(Color(red: 0.125, green: 0.141, blue: 0.169)).cornerRadius(14)
    }
}

private struct NoteEditor: View {
    @Binding var note: DecoyNote
    let onDone: () -> Void
    private let yellow = Color(red: 0.969, green: 0.808, blue: 0.275)

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: onDone) {
                    Text("‹ Notes").font(.system(size: 18, weight: .semibold))
                        .foregroundColor(Color(red: 0.16, green: 0.14, blue: 0))
                }
                Spacer()
                Button(action: onDone) {
                    Text("Done").font(.system(size: 16, weight: .bold))
                        .foregroundColor(Color(red: 0.16, green: 0.14, blue: 0))
                }
            }.padding(16).frame(maxWidth: .infinity).background(yellow)

            TextField("Title", text: $note.title)
                .font(.system(size: 24, weight: .bold)).foregroundColor(.white)
                .padding(.horizontal, 20).padding(.top, 20)
            TextEditor(text: $note.body)
                .font(.system(size: 16)).foregroundColor(Color(white: 0.82))
                .scrollContentBackground(.hidden)
                .padding(.horizontal, 16).padding(.top, 8)
            Spacer()
        }
        .background(Color(red: 0.078, green: 0.09, blue: 0.11).ignoresSafeArea())
    }
}
