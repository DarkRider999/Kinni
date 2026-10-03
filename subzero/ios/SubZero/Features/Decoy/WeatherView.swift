import SwiftUI

/// A believable Weather decoy: current conditions, an hourly strip, and a 5-day
/// forecast. Values vary a little by the hour so it looks live. Blue gradient
/// matches the Weather disguise icon.
private struct DHour: Identifiable { let id = UUID(); let label: String; let glyph: String; let temp: Int }
private struct DDay: Identifiable { let id = UUID(); let label: String; let glyph: String; let hi: Int; let lo: Int }

struct WeatherView: View {
    private let hour = Calendar.current.component(.hour, from: Date())

    private var current: Int { 18 + (hour % 7) }
    private var condition: String { (6...17).contains(hour) ? "Partly Cloudy" : "Clear" }
    private var glyph: String { (6...17).contains(hour) ? "⛅️" : "☀️" }

    private var hours: [DHour] {
        (0...7).map { i in
            let h = (hour + i) % 24
            let g = (6...17).contains(h) ? ["☀️", "⛅️", "☁️"].randomElement()! : "🌙"
            return DHour(label: i == 0 ? "Now" : String(format: "%02d:00", h),
                         glyph: g, temp: current + Int.random(in: -2...3))
        }
    }
    private let days: [DDay] = ["Mon", "Tue", "Wed", "Thu", "Fri"].enumerated().map { i, d in
        DDay(label: d, glyph: ["☀️", "⛅️", "☁️", "🌧"].randomElement()!, hi: 21 + i % 4, lo: 12 + i % 3)
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.29, green: 0.64, blue: 0.94), Color(red: 0.12, green: 0.37, blue: 0.66)],
                           startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            VStack(spacing: 6) {
                Spacer().frame(height: 20)
                Text("San Francisco").font(.system(size: 26, weight: .medium)).foregroundColor(.white)
                Text("\(current)°").font(.system(size: 88, weight: .thin)).foregroundColor(.white)
                Text("\(glyph)  \(condition)").font(.system(size: 18)).foregroundColor(.white)
                Text("H:\(current + 4)°   L:\(current - 6)°").font(.system(size: 15)).foregroundColor(.white.opacity(0.8))

                Spacer().frame(height: 24)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 24) {
                        ForEach(hours) { h in
                            VStack(spacing: 8) {
                                Text(h.label).font(.system(size: 13)).foregroundColor(.white.opacity(0.8))
                                Text(h.glyph).font(.system(size: 22))
                                Text("\(h.temp)°").font(.system(size: 16, weight: .semibold)).foregroundColor(.white)
                            }
                        }
                    }.padding(12)
                }.background(Color.black.opacity(0.2)).cornerRadius(18)

                VStack(spacing: 0) {
                    ForEach(days) { d in
                        HStack {
                            Text(d.label).font(.system(size: 16)).foregroundColor(.white).frame(width: 56, alignment: .leading)
                            Text(d.glyph).font(.system(size: 20))
                            Spacer()
                            Text("\(d.lo)°").font(.system(size: 16)).foregroundColor(.white.opacity(0.6))
                            Text("\(d.hi)°").font(.system(size: 16, weight: .semibold)).foregroundColor(.white).padding(.leading, 16)
                        }.padding(.vertical, 10)
                    }
                }.padding(.horizontal, 16).background(Color.black.opacity(0.2)).cornerRadius(18)
                Spacer()
            }.padding(20)
        }
    }
}
