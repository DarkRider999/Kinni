import SwiftUI

/// A real, working calculator used as an identity disguise and SafeZone decoy.
struct CalculatorView: View {
    @State private var display = "0"
    @State private var accumulator: Double?
    @State private var pendingOp: String?
    @State private var freshEntry = true

    private let ink = Color(red: 0.043, green: 0.059, blue: 0.078)
    private let neon = Color(red: 0.208, green: 0.878, blue: 0.769)
    private let rows = [
        ["C", "±", "%", "÷"],
        ["7", "8", "9", "×"],
        ["4", "5", "6", "−"],
        ["1", "2", "3", "+"],
        ["0", ".", "="],
    ]

    var body: some View {
        VStack(spacing: 12) {
            Spacer()
            Text(display).font(.system(size: 64, weight: .light))
                .foregroundColor(.white).lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .trailing).padding()
            ForEach(rows, id: \.self) { row in
                HStack(spacing: 12) {
                    ForEach(row, id: \.self) { key in button(key) }
                }
            }
        }
        .padding().background(ink.ignoresSafeArea())
    }

    private func button(_ key: String) -> some View {
        let accent = ["÷", "×", "−", "+", "="].contains(key)
        return Button(action: { tap(key) }) {
            Text(key).font(.system(size: 28)).foregroundColor(accent ? .black : .white)
                .frame(maxWidth: .infinity)
                .frame(height: 72)
                .background(accent ? neon : Color(red: 0.106, green: 0.145, blue: 0.188))
                .clipShape(Capsule())
        }.frame(maxWidth: key == "0" ? .infinity : nil)
    }

    private func tap(_ key: String) {
        switch key {
        case "C": display = "0"; accumulator = nil; pendingOp = nil; freshEntry = true
        case "±": display = format((Double(display) ?? 0) * -1)
        case "%": display = format((Double(display) ?? 0) / 100)
        case "÷", "×", "−", "+": setOp(key)
        case "=": equals()
        case ".": if !display.contains(".") { display += "."; freshEntry = false }
        default: display = (freshEntry || display == "0") ? key : display + key; freshEntry = false
        }
    }

    private func applyPending() -> Double {
        let cur = Double(display) ?? 0
        guard let acc = accumulator else { return cur }
        switch pendingOp {
        case "+": return acc + cur; case "−": return acc - cur
        case "×": return acc * cur; case "÷": return cur != 0 ? acc / cur : .nan
        default: return cur
        }
    }
    private func setOp(_ op: String) {
        accumulator = applyPending(); display = format(accumulator!); pendingOp = op; freshEntry = true
    }
    private func equals() {
        display = format(applyPending()); accumulator = nil; pendingOp = nil; freshEntry = true
    }
    private func format(_ d: Double) -> String {
        d.isNaN ? "Error" : (d == d.rounded() ? String(Int(d)) : String(d))
    }
}
