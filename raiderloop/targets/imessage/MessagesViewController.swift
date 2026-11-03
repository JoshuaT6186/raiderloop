// Flyer in Messages.
//
// Two things, both on sticky notes:
//   1. Plan polls. "Pizza or tacos?" with up to 6 options. The poll
//      lives inside the message: each tap updates the same bubble for
//      everyone (one vote per person, you can change it). Friends
//      without Flyer who tap the bubble get a read-only web page.
//   2. Share an event you saved or said you're going to. Sends the
//      Flyer link, so Messages shows the rich preview card.
//
// The event list comes from the App Group snapshot the app writes
// (src/lib/widget.js, key "imessage"). Polls need no account and no
// network: everything is in the message URL.

import Messages
import SwiftUI
import UIKit

let flyerAppGroup = "group.com.joshuat8808.flyer"
let defaultShareBase = "https://raiderloop-98046.web.app"

// MARK: - Data from the app

struct SharedItem: Decodable, Identifiable, Hashable {
  let id: String
  let title: String
  let when: String
  let place: String
  let url: String
}

struct MessagesSnapshot: Decodable {
  let base: String?
  let name: String?
  let items: [SharedItem]
  let freeToday: [String]?
}

func loadMessagesSnapshot() -> MessagesSnapshot? {
  guard let defaults = UserDefaults(suiteName: flyerAppGroup),
        let raw = defaults.string(forKey: "imessage"),
        let data = raw.data(using: .utf8) else { return nil }
  return try? JSONDecoder().decode(MessagesSnapshot.self, from: data)
}

// MARK: - Poll model (lives in the message URL)

struct Poll: Equatable {
  var question: String
  var options: [String]
  var votes: [String: Int] // participant id -> option index

  func count(_ i: Int) -> Int { votes.values.filter { $0 == i }.count }
  var total: Int { votes.count }

  func url(base: String) -> URL? {
    var c = URLComponents(string: base.hasSuffix("/") ? base + "m" : base + "/m")
    var items = [URLQueryItem(name: "q", value: question)]
    items += options.map { URLQueryItem(name: "o", value: $0) }
    items += votes.sorted { $0.key < $1.key }.map { URLQueryItem(name: "v", value: "\($0.key):\($0.value)") }
    c?.queryItems = items
    return c?.url
  }

  static func from(_ url: URL?) -> Poll? {
    guard let url = url, let c = URLComponents(url: url, resolvingAgainstBaseURL: false),
          c.path.hasSuffix("/m"), let items = c.queryItems else { return nil }
    let q = items.first { $0.name == "q" }?.value ?? ""
    let opts = items.filter { $0.name == "o" }.compactMap { $0.value }
    var votes: [String: Int] = [:]
    for v in items where v.name == "v" {
      let parts = (v.value ?? "").split(separator: ":")
      if parts.count == 2, let i = Int(parts[1]), i >= 0, i < opts.count { votes[String(parts[0])] = i }
    }
    if q.isEmpty || opts.count < 2 { return nil }
    return Poll(question: q, options: opts, votes: votes)
  }
}

// MARK: - Controller

final class MessagesViewController: MSMessagesAppViewController {
  private var host: UIHostingController<AnyView>?
  private var snapshot: MessagesSnapshot? = nil

  private var base: String {
    let b = snapshot?.base ?? ""
    return b.isEmpty ? defaultShareBase : b
  }

  override func willBecomeActive(with conversation: MSConversation) {
    super.willBecomeActive(with: conversation)
    snapshot = loadMessagesSnapshot()
    render(for: conversation)
  }

  override func didTransition(to presentationStyle: MSMessagesAppPresentationStyle) {
    super.didTransition(to: presentationStyle)
    if let c = activeConversation { render(for: c) }
  }

  override func didSelect(_ message: MSMessage, conversation: MSConversation) {
    super.didSelect(message, conversation: conversation)
    render(for: conversation)
  }

  private func render(for conversation: MSConversation) {
    let me = conversation.localParticipantIdentifier.uuidString
    let root: AnyView
    if let selected = conversation.selectedMessage, let poll = Poll.from(selected.url) {
      root = AnyView(PollVoteView(poll: poll, me: me, onVote: { [weak self] i in
        self?.vote(i, on: poll, message: selected, conversation: conversation)
      }))
    } else {
      root = AnyView(HomeView(
        items: snapshot?.items ?? [],
        freeToday: snapshot?.freeToday ?? [],
        expanded: presentationStyle == .expanded,
        onExpand: { [weak self] in self?.requestPresentationStyle(.expanded) },
        onSend: { [weak self] item in self?.send(item, conversation: conversation) },
        onPoll: { [weak self] q, opts in self?.sendPoll(q, opts, conversation: conversation) }
      ))
    }
    if let host = host {
      host.rootView = root
    } else {
      let h = UIHostingController(rootView: root)
      addChild(h)
      h.view.translatesAutoresizingMaskIntoConstraints = false
      h.view.backgroundColor = .clear
      view.addSubview(h.view)
      NSLayoutConstraint.activate([
        h.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
        h.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        h.view.topAnchor.constraint(equalTo: view.topAnchor),
        h.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      ])
      h.didMove(toParent: self)
      host = h
    }
  }

  private func layout(for poll: Poll) -> MSMessageTemplateLayout {
    let l = MSMessageTemplateLayout()
    l.caption = "📌 \(poll.question)"
    let leader = poll.options.indices.max { poll.count($0) < poll.count($1) }
    if poll.total == 0 {
      l.subcaption = poll.options.joined(separator: " · ")
      l.trailingSubcaption = "Tap to vote"
    } else {
      l.subcaption = poll.options.enumerated().map { "\($0.element) \(poll.count($0.offset))" }.joined(separator: " · ")
      if let i = leader, poll.count(i) > 0 { l.trailingSubcaption = "\(poll.options[i]) leads" }
    }
    l.image = PollCard.render(poll: poll)
    return l
  }

  private func sendPoll(_ question: String, _ options: [String], conversation: MSConversation) {
    let poll = Poll(question: question, options: options, votes: [:])
    let m = MSMessage(session: MSSession())
    m.url = poll.url(base: base)
    m.layout = layout(for: poll)
    m.summaryText = "Poll: \(question)"
    conversation.insert(m) { _ in }
    requestPresentationStyle(.compact)
  }

  private func vote(_ i: Int, on poll: Poll, message: MSMessage, conversation: MSConversation) {
    var p = poll
    p.votes[conversation.localParticipantIdentifier.uuidString] = i
    let m = MSMessage(session: message.session ?? MSSession())
    m.url = p.url(base: base)
    m.layout = layout(for: p)
    m.summaryText = "Voted \(p.options[i]) on \(p.question)"
    conversation.insert(m) { _ in }
    dismiss()
  }

  private func send(_ item: SharedItem, conversation: MSConversation) {
    // A plain link gives the rich preview card from the share page.
    let text = [item.title, item.when, item.place].filter { !$0.isEmpty }.joined(separator: " · ")
    if let url = URL(string: item.url), !item.url.isEmpty {
      conversation.insertText("\(text)\n\(url.absoluteString)") { _ in }
    } else {
      conversation.insertText(text) { _ in }
    }
    requestPresentationStyle(.compact)
  }
}

// MARK: - Bubble image

enum PollCard {
  static func render(poll: Poll) -> UIImage? {
    let size = CGSize(width: 600, height: 120 + CGFloat(poll.options.count) * 64)
    let r = UIGraphicsImageRenderer(size: size)
    return r.image { ctx in
      UIColor(red: 1.0, green: 0.92, blue: 0.52, alpha: 1).setFill()
      ctx.fill(CGRect(origin: .zero, size: size))
      let ink = UIColor(red: 0.12, green: 0.16, blue: 0.27, alpha: 1)
      let title = NSAttributedString(string: poll.question, attributes: [.font: UIFont.systemFont(ofSize: 38, weight: .heavy), .foregroundColor: ink])
      title.draw(in: CGRect(x: 28, y: 26, width: size.width - 56, height: 70))
      let total = max(1, poll.total)
      for (i, o) in poll.options.enumerated() {
        let y = 104 + CGFloat(i) * 64
        let bar = CGRect(x: 28, y: y, width: size.width - 56, height: 50)
        UIColor.white.withAlphaComponent(0.8).setFill()
        UIBezierPath(roundedRect: bar, cornerRadius: 12).fill()
        let pct = CGFloat(poll.count(i)) / CGFloat(total)
        if poll.count(i) > 0 {
          UIColor(red: 0.62, green: 0.86, blue: 0.75, alpha: 1).setFill()
          UIBezierPath(roundedRect: CGRect(x: bar.minX, y: bar.minY, width: max(24, bar.width * pct), height: bar.height), cornerRadius: 12).fill()
        }
        ink.setStroke()
        let border = UIBezierPath(roundedRect: bar, cornerRadius: 12); border.lineWidth = 3; border.stroke()
        let label = NSAttributedString(string: o, attributes: [.font: UIFont.systemFont(ofSize: 26, weight: .bold), .foregroundColor: ink])
        label.draw(in: CGRect(x: bar.minX + 16, y: bar.minY + 10, width: bar.width - 90, height: 34))
        let n = NSAttributedString(string: "\(poll.count(i))", attributes: [.font: UIFont.systemFont(ofSize: 26, weight: .heavy), .foregroundColor: ink])
        n.draw(at: CGPoint(x: bar.maxX - 46, y: bar.minY + 10))
      }
    }
  }
}

// MARK: - Views

struct PollOption: Identifiable, Equatable {
  let id = UUID()
  var text: String
}

struct Note<Content: View>: View {
  var color: Color = Color("Note")
  var tilt: Double = -1
  @ViewBuilder var content: Content
  var body: some View {
    VStack(alignment: .leading, spacing: 6) { content }
      .padding(14)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(color)
      .clipShape(RoundedRectangle(cornerRadius: 4))
      .shadow(color: .black.opacity(0.12), radius: 4, y: 2)
      .rotationEffect(.degrees(tilt))
  }
}

struct HomeView: View {
  let items: [SharedItem]
  let freeToday: [String]
  let expanded: Bool
  let onExpand: () -> Void
  let onSend: (SharedItem) -> Void
  let onPoll: (String, [String]) -> Void

  @State private var making = false
  @State private var question = ""
  @State private var options = [PollOption(text: ""), PollOption(text: "")]

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        HStack {
          Text("✈︎ Flyer").font(.system(size: 17, weight: .heavy)).foregroundColor(Color("Ink"))
          Spacer()
          Button {
            making = true
            if question.isEmpty && !freeToday.isEmpty {
              options = Array(freeToday.prefix(3)).map { PollOption(text: $0) } + (freeToday.count < 2 ? [PollOption(text: "")] : [])
            }
            onExpand()
          } label: {
            Label("Plan poll", systemImage: "checklist").font(.system(size: 15, weight: .bold))
          }
          .buttonStyle(.borderedProminent).tint(Color("Accent"))
        }
        if making && expanded {
          PollComposer(question: $question, options: $options, onCancel: { making = false }, onSend: {
            let opts = options.map { $0.text.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
            onPoll(question.trimmingCharacters(in: .whitespaces), opts)
            making = false; question = ""; options = [PollOption(text: ""), PollOption(text: "")]
          })
        } else if items.isEmpty {
          Note(tilt: -0.8) {
            Text("Nothing saved yet").font(.system(size: 16, weight: .bold)).foregroundColor(Color("Ink"))
            Text("Save an event or tap Going in Flyer and it shows up here to send. Or make a plan poll.").font(.system(size: 14)).foregroundColor(Color("Ink").opacity(0.8))
          }
        } else {
          Text("Send an event").font(.system(size: 12, weight: .bold)).foregroundColor(.secondary)
          ForEach(Array(items.prefix(expanded ? 20 : 4).enumerated()), id: \.element.id) { i, item in
            Button { onSend(item) } label: {
              Note(color: i % 2 == 0 ? Color("Note") : Color(red: 0.75, green: 0.89, blue: 0.97), tilt: i % 2 == 0 ? -0.6 : 0.6) {
                Text(item.title).font(.system(size: 16, weight: .heavy)).foregroundColor(Color("Ink")).lineLimit(2)
                Text([item.when, item.place].filter { !$0.isEmpty }.joined(separator: " · ")).font(.system(size: 13)).foregroundColor(Color("Ink").opacity(0.8)).lineLimit(2)
              }
            }
            .buttonStyle(.plain)
          }
          if !expanded && items.count > 4 {
            Button("Show all \(items.count)") { onExpand() }.font(.system(size: 14, weight: .bold))
          }
        }
      }
      .padding(16)
    }
    .background(Color("Paper"))
  }
}

struct PollComposer: View {
  @Binding var question: String
  @Binding var options: [PollOption]
  let onCancel: () -> Void
  let onSend: () -> Void

  private var ready: Bool {
    !question.trimmingCharacters(in: .whitespaces).isEmpty &&
      options.filter { !$0.text.trimmingCharacters(in: .whitespaces).isEmpty }.count >= 2
  }

  var body: some View {
    Note(tilt: -0.5) {
      Text("Plan poll").font(.system(size: 12, weight: .bold)).foregroundColor(Color("Ink").opacity(0.7))
      TextField("What are we deciding?", text: $question)
        .font(.system(size: 18, weight: .bold)).foregroundColor(Color("Ink"))
        .textFieldStyle(.roundedBorder)
      ForEach($options) { $opt in
        HStack {
          TextField("Option", text: $opt.text).textFieldStyle(.roundedBorder)
          if options.count > 2 {
            Button {
              let id = opt.id
              options.removeAll { $0.id == id }
            } label: { Image(systemName: "minus.circle") }.foregroundColor(Color("Ink"))
          }
        }
      }
      if options.count < 6 {
        Button { options.append(PollOption(text: "")) } label: { Label("Add an option", systemImage: "plus") }
          .font(.system(size: 14, weight: .bold)).foregroundColor(Color("Ink"))
      }
      HStack {
        Button("Cancel", action: onCancel).foregroundColor(Color("Ink"))
        Spacer()
        Button("Send poll", action: onSend).buttonStyle(.borderedProminent).tint(Color("Accent")).disabled(!ready)
      }
      .padding(.top, 4)
      Text("Everyone in the chat can vote and change their vote. Votes stay in this conversation.")
        .font(.system(size: 12)).foregroundColor(Color("Ink").opacity(0.7))
    }
  }
}

struct PollVoteView: View {
  let poll: Poll
  let me: String
  let onVote: (Int) -> Void

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 12) {
        Note(tilt: -0.6) {
          Text("Plan poll").font(.system(size: 12, weight: .bold)).foregroundColor(Color("Ink").opacity(0.7))
          Text(poll.question).font(.system(size: 22, weight: .heavy)).foregroundColor(Color("Ink"))
          Text(poll.total == 1 ? "1 vote so far" : "\(poll.total) votes so far").font(.system(size: 13)).foregroundColor(Color("Ink").opacity(0.75))
        }
        ForEach(poll.options.indices, id: \.self) { i in
          Button { onVote(i) } label: {
            HStack {
              Image(systemName: poll.votes[me] == i ? "checkmark.circle.fill" : "circle")
              Text(poll.options[i]).font(.system(size: 17, weight: .bold))
              Spacer()
              Text("\(poll.count(i))").font(.system(size: 17, weight: .heavy)).monospacedDigit()
            }
            .foregroundColor(Color("Ink"))
            .padding(14)
            .background(
              GeometryReader { g in
                ZStack(alignment: .leading) {
                  RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.85))
                  RoundedRectangle(cornerRadius: 12).fill(Color(red: 0.62, green: 0.86, blue: 0.75))
                    .frame(width: poll.total == 0 ? 0 : g.size.width * CGFloat(poll.count(i)) / CGFloat(max(1, poll.total)))
                }
              }
            )
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color("Ink"), lineWidth: 2))
          }
          .buttonStyle(.plain)
        }
        Text(poll.votes[me] == nil ? "Tap an option to vote." : "Tap another option to change your vote.")
          .font(.system(size: 13)).foregroundColor(.secondary)
      }
      .padding(16)
    }
    .background(Color("Paper"))
  }
}
