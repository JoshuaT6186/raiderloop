// Flyer home-screen widget.
// Reads the snapshot the app writes to the shared App Group
// (src/lib/widget.js) and shows your next class, what's due, and
// the weather — on a sticky note.

import WidgetKit
import SwiftUI

let appGroup = "group.com.joshuat8808.flyer"

struct Snapshot: Decodable {
  struct NextClass: Decodable { let title: String; let place: String; let time: String; let endTime: String }
  struct Due: Decodable { let title: String; let due: String }
  let next: NextClass?
  let todayCount: Int
  let due: Due?
  let weather: String
}

struct Entry: TimelineEntry {
  let date: Date
  let snap: Snapshot?
}

func loadSnapshot() -> Snapshot? {
  guard let defaults = UserDefaults(suiteName: appGroup),
        let raw = defaults.string(forKey: "snapshot"),
        let data = raw.data(using: .utf8) else { return nil }
  return try? JSONDecoder().decode(Snapshot.self, from: data)
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry { Entry(date: .now, snap: nil) }
  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(Entry(date: .now, snap: loadSnapshot()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let entry = Entry(date: .now, snap: loadSnapshot())
    // Refresh every 15 minutes; the app also forces a reload whenever the schedule changes.
    completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(15 * 60))))
  }
}

struct FlyerWidgetView: View {
  var entry: Entry
  @Environment(\.widgetFamily) var family

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        Text("✈︎ Flyer").font(.system(size: 12, weight: .heavy)).foregroundColor(Color("Ink"))
        Spacer()
        if let w = entry.snap?.weather, !w.isEmpty {
          Text(w).font(.system(size: 11, weight: .semibold)).foregroundColor(Color("Ink").opacity(0.7))
        }
      }
      if let next = entry.snap?.next {
        Text("UP NEXT").font(.system(size: 9, weight: .bold)).foregroundColor(Color("Ink").opacity(0.6)).padding(.top, 2)
        Text(next.title).font(.system(size: 18, weight: .heavy)).foregroundColor(Color("Ink")).lineLimit(1)
        Text("\(next.time) · \(next.place)").font(.system(size: 12)).foregroundColor(Color("Ink").opacity(0.8)).lineLimit(2)
      } else {
        Text("No more classes today").font(.system(size: 15, weight: .bold)).foregroundColor(Color("Ink")).padding(.top, 4)
      }
      Spacer(minLength: 0)
      if family != .systemSmall, let due = entry.snap?.due {
        Text("Due: \(due.title)").font(.system(size: 12, weight: .semibold)).foregroundColor(Color("Ink")).lineLimit(1)
          .padding(.horizontal, 6).padding(.vertical, 3)
          .background(Color("Note"))
      }
    }
    .padding(2)
    .containerBackground(for: .widget) { Color("WidgetBackground") }
  }
}

@main
struct FlyerWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "FlyerWidget", provider: Provider()) { entry in
      FlyerWidgetView(entry: entry)
    }
    .configurationDisplayName("Up next")
    .description("Your next class, what's due, and the weather.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
