// Flyer widgets.
// Reads the snapshot the app writes to the shared App Group
// (src/lib/widget.js): your next class, when to leave for it, what's
// due, and the weather.
//
//  • Home screen (small, medium): a sticky note.
//  • Lock screen (inline, circular, rectangular): the next class and a
//    live "leave in 6 min" countdown that iOS ticks down on its own.

import WidgetKit
import SwiftUI

let appGroup = "group.com.joshuat8808.flyer"

struct Snapshot: Decodable {
  struct NextClass: Decodable {
    let title: String
    let place: String
    let time: String
    let endTime: String
    let startAt: String?
    let leaveAt: String?
    let walk: Int?
  }
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

let iso: ISO8601DateFormatter = {
  let f = ISO8601DateFormatter()
  f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return f
}()

func parseDate(_ s: String?) -> Date? {
  guard let s = s else { return nil }
  if let d = iso.date(from: s) { return d }
  let plain = ISO8601DateFormatter()
  return plain.date(from: s)
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
    let snap = loadSnapshot()
    var entries = [Entry(date: .now, snap: snap)]
    // Extra entries right at leave time and class start so the wording
    // flips from "Leave in" to "Leave now" to "Started" on time.
    for d in [parseDate(snap?.next?.leaveAt), parseDate(snap?.next?.startAt)].compactMap({ $0 }) where d > .now {
      entries.append(Entry(date: d, snap: snap))
    }
    entries.sort { $0.date < $1.date }
    // The app also reloads the widget whenever the schedule changes.
    completion(Timeline(entries: entries, policy: .after(.now.addingTimeInterval(15 * 60))))
  }
}

// MARK: - Shared bits

struct LeaveLine: View {
  let next: Snapshot.NextClass
  let now: Date
  var body: some View {
    if let leave = parseDate(next.leaveAt), let walk = next.walk {
      if leave > now {
        (Text("Leave in ") + Text(leave, style: .relative)).monospacedDigit()
      } else if let start = parseDate(next.startAt), start > now {
        Text("Leave now · \(walk) min walk")
      } else {
        Text("Started at \(next.time)")
      }
    } else if let start = parseDate(next.startAt), start > now {
      (Text("Starts in ") + Text(start, style: .relative)).monospacedDigit()
    } else {
      Text("\(next.time) · \(next.place)")
    }
  }
}

// MARK: - Home screen

struct NoteView: View {
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
        if next.leaveAt != nil {
          LeaveLine(next: next, now: entry.date)
            .font(.system(size: 11, weight: .bold)).foregroundColor(Color("Ink"))
            .padding(.horizontal, 5).padding(.vertical, 2)
            .background(Color("Note"))
        }
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

// MARK: - Lock screen

struct LockView: View {
  var entry: Entry
  @Environment(\.widgetFamily) var family

  var body: some View {
    switch family {
    case .accessoryInline:
      if let next = entry.snap?.next {
        if next.leaveAt != nil { LeaveLine(next: next, now: entry.date) } else { Text("✈︎ \(next.title) · \(next.time)") }
      } else {
        Text("✈︎ No more classes today")
      }
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        if let next = entry.snap?.next, let leave = parseDate(next.leaveAt), leave > entry.date {
          VStack(spacing: 0) {
            Text("LEAVE").font(.system(size: 9, weight: .heavy))
            Text(leave, style: .timer).font(.system(size: 13, weight: .bold)).monospacedDigit().multilineTextAlignment(.center)
          }
        } else if let next = entry.snap?.next {
          VStack(spacing: 0) {
            Text("✈︎").font(.system(size: 12))
            Text(next.time.replacingOccurrences(of: " ", with: "\n")).font(.system(size: 11, weight: .bold)).multilineTextAlignment(.center)
          }
        } else {
          Text("✈︎").font(.system(size: 20))
        }
      }
      .widgetAccentable()
    default:
      VStack(alignment: .leading, spacing: 1) {
        if let next = entry.snap?.next {
          Text(next.title).font(.system(size: 15, weight: .heavy)).lineLimit(1).widgetAccentable()
          Text("\(next.time) · \(next.place)").font(.system(size: 12)).lineLimit(1)
          LeaveLine(next: next, now: entry.date).font(.system(size: 12, weight: .semibold)).lineLimit(1)
        } else {
          Text("✈︎ Flyer").font(.system(size: 13, weight: .heavy)).widgetAccentable()
          Text("No more classes today").font(.system(size: 12))
          if let due = entry.snap?.due { Text("Due: \(due.title)").font(.system(size: 12)).lineLimit(1) }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

struct FlyerWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "FlyerWidget", provider: Provider()) { entry in
      NoteView(entry: entry)
    }
    .configurationDisplayName("Up next")
    .description("Your next class, when to leave, and what's due.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct FlyerLockWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "FlyerLockWidget", provider: Provider()) { entry in
      LockView(entry: entry)
        .containerBackground(for: .widget) { Color.clear }
    }
    .configurationDisplayName("Leave now")
    .description("Your next class and a countdown to when you should start walking.")
    .supportedFamilies([.accessoryInline, .accessoryCircular, .accessoryRectangular])
  }
}

@main
struct FlyerWidgets: WidgetBundle {
  var body: some Widget {
    FlyerWidget()
    FlyerLockWidget()
  }
}
