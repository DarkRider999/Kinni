import SwiftUI

/// Playable Tic-Tac-Toe SafeZone decoy game.
struct TicTacToeView: View {
    @State private var board = Array(repeating: "", count: 9)
    @State private var xTurn = true

    private let ink = Color(red: 0.043, green: 0.059, blue: 0.078)
    private let neon = Color(red: 0.208, green: 0.878, blue: 0.769)

    var body: some View {
        VStack(spacing: 16) {
            Text(status).font(.title).bold().foregroundColor(neon)
            ForEach(0..<3) { row in
                HStack(spacing: 8) {
                    ForEach(0..<3) { col in cell(row * 3 + col) }
                }
            }
            Button("New game") { board = Array(repeating: "", count: 9); xTurn = true }
                .tint(neon)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(ink.ignoresSafeArea())
    }

    private func cell(_ i: Int) -> some View {
        Button {
            guard board[i].isEmpty, winner == nil else { return }
            board[i] = xTurn ? "X" : "O"; xTurn.toggle()
        } label: {
            Text(board[i]).font(.system(size: 40)).foregroundColor(.white)
                .frame(width: 88, height: 88)
                .background(Color(red: 0.086, green: 0.125, blue: 0.169))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    private var status: String {
        if let w = winner { return "\(w) wins!" }
        if !board.contains("") { return "Draw" }
        return "\(xTurn ? "X" : "O")'s turn"
    }

    private var winner: String? {
        let lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
        for l in lines where !board[l[0]].isEmpty
            && board[l[0]] == board[l[1]] && board[l[1]] == board[l[2]] {
            return board[l[0]]
        }
        return nil
    }
}
