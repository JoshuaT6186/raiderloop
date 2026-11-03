/**
 * Play: Flight Score, stamps, scavenger hunts, leaderboards, and games.
 * Points come from doing real campus things (hunts, events you
 * actually go to, sharing notes, saying hi), never from scrolling.
 * Leaderboards are friends-only unless you turn on the campus board.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  T, PostIt, PT, Card, Button, Loading, Empty, Check, Toggle, Row,
} from '../ui/Paper';
import { FolderTabs, RubberStamp, StampThunk, Highlighter, SectionNote } from '../ui/Kit';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';

export const STAMPS = [
  { id: 'first-hi', label: 'First hello', hint: 'Say hi to someone and become friends', color: '#2F5BD3' },
  { id: 'first-postcard', label: 'First postcard', hint: 'Pin a Postcard somewhere on campus', color: '#E0533F' },
  { id: 'regular', label: '5 events', hint: 'Check in at 5 Discover events', color: '#3FA66A' },
  { id: 'note-hero', label: 'Note hero', hint: 'Share class notes with classmates', color: '#B7791F' },
  { id: 'hide-seek', label: 'Hide & seek', hint: 'Play a round with friends', color: '#7B4FC9' },
  { id: 'hunt-campus', label: 'Explorer', hint: 'Finish the Campus Explorer hunt', color: '#2E8256' },
  { id: 'hunt-fall', label: 'Fall hunt', hint: 'Finish the Fall Hunt (November)', color: '#C8413B' },
  { id: 'hunt-winter', label: 'Winter lights', hint: 'Finish the Winter Lights Hunt (December)', color: '#2F5BD3' },
  { id: 'hunt-newyear', label: 'New Year', hint: 'Finish the New Year Hunt (Jan 1–7)', color: '#B7791F' },
  { id: 'hunt-valentine', label: "Valentine's", hint: "Finish the Valentine's Hunt (Feb 1–14)", color: '#D6457A' },
  { id: 'hunt-stpatrick', label: 'Lucky', hint: "Finish the St. Patrick's Hunt (Mar 11–17)", color: '#3FA66A' },
];
const seasonName = (id = '') => { const [s, y] = id.split('-'); return s ? `${s[0].toUpperCase()}${s.slice(1)} '${(y || '').slice(2)}` : ''; };

function Leaderboard() {
  const { t } = useTheme();
  const { leaderboardPublic, set } = useApp();
  const [scope, setScope] = useState('friends');
  const [rows, setRows] = useState(null);
  useEffect(() => { setRows(null); api.getLeaderboard({ scope }).then((r) => setRows(r.data.rows || [])).catch(() => setRows([])); }, [scope, leaderboardPublic]);
  return (
    <View>
      <FolderTabs small value={scope} onChange={setScope} tabs={[{ id: 'friends', label: 'Friends', color: 'yellow' }, { id: 'campus', label: 'Campus', color: 'green' }, { id: 'orgs', label: 'Orgs', color: 'blue' }]} />
      {scope !== 'friends' ? (
        <Card style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <T kind="small" style={{ flex: 1 }}>{scope === 'campus' ? 'Only people who turned this on show up here (first name and last initial).' : 'Orgs add up the points of members who are on the campus board.'}</T>
            <Toggle value={leaderboardPublic} onChange={(v) => { set({ leaderboardPublic: v }); api.setLeaderboard({ public: v }).catch(() => {}); }} label="Show me on the campus board" />
          </View>
        </Card>
      ) : null}
      {rows === null ? <Loading /> : rows.length ? rows.map((r, i) => (
        <View key={r.uid || r.name} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: t.rule, borderStyle: 'dashed', backgroundColor: r.me ? t.postit.yellow : 'transparent', paddingHorizontal: r.me ? 6 : 0, borderRadius: 6 }}>
          <T kind="handBig" style={{ width: 34, fontSize: 24 }} color={r.me ? '#1F2A44' : undefined}>{i + 1}</T>
          {r.avatar ? <Avatar config={r.avatar} size={32} /> : <Icon name="users" />}
          <T kind="bold" style={{ flex: 1, marginLeft: 10 }} color={r.me ? '#1F2A44' : undefined}>{r.name}{r.people ? ` · ${r.people} people` : ''}</T>
          <T kind="num" color={r.me ? '#1F2A44' : undefined}>{(r.points || 0).toLocaleString()}</T>
        </View>
      )) : <Empty icon="trophy" title={scope === 'friends' ? 'Add friends to compare' : 'Nobody on this board yet'} />}
    </View>
  );
}

function Hunt({ h }) {
  const { setSheet } = useApp();
  const done = h.items.filter((i) => i.done).length;
  return (
    <PostIt color="orange" tape style={{ marginBottom: 16 }} seed={h.id}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <PT kind="title" style={{ flex: 1 }}>{h.title}</PT>
        <PT kind="small">{done} of {h.items.length} · +{h.bonus} when done</PT>
      </View>
      {h.items.map((i) => (
        <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
          <Check checked={i.done} onPress={() => (i.done ? null : setSheet({ type: 'compose', kind: 'hunt', hunt: h, item: i }))} label={i.label} />
          <PT style={[{ flex: 1, marginLeft: 10 }, i.done ? { textDecorationLine: 'line-through', opacity: 0.6 } : null]}>{i.label}</PT>
          {!i.done ? <Button title="Take a pic" icon="camera" small kind="ghost" onPress={() => setSheet({ type: 'compose', kind: 'hunt', hunt: h, item: i })} style={{ backgroundColor: '#fff' }} /> : null}
        </View>
      ))}
      <PT kind="small" style={{ marginTop: 6 }}>Objects and places only, never people. Your photo also goes to your friends' feeds.</PT>
    </PostIt>
  );
}

export function PlayPage() {
  const { t } = useTheme();
  const { score, user, setSheet, games, gameInvites } = useApp();
  const [play, setPlay] = useState(null);
  const [tab, setTab] = useState('score');
  const signedIn = user && !user.isAnonymous;
  useEffect(() => { if (signedIn) api.getPlay({}).then((r) => setPlay(r.data)).catch(() => setPlay({ hunts: [], recent: [] })); }, [signedIn, score?.points]);
  if (!signedIn) {
    return <PostIt color="yellow" tape style={{ marginTop: 14 }}><PT kind="bold">Flight Score needs an account</PT><PT kind="small">So your points and stamps follow you.</PT><Button title="Make an account" small onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 10 }} /></PostIt>;
  }
  const points = play?.points ?? score?.points ?? 0;
  const stamps = new Set((play?.stamps || score?.stamps || []).map((s) => s.id));
  const liveGames = games.filter((g) => g.status !== 'ended');
  return (
    <View>
      <PostIt color="yellow" tilt={-1} tape style={{ marginTop: 10 }} padding={18}>
        <PT kind="tiny">Flight Score · {seasonName(play?.season || score?.season) || 'this semester'}</PT>
        <Highlighter><T kind="marker" color="#1F2A44" style={{ fontSize: 48, lineHeight: 56 }}>{points.toLocaleString()}</T></Highlighter>
        <PT kind="small">{play ? `#${play.friendsRank} of ${play.friendsCount} among friends · resets when the semester ends` : 'Resets when the semester ends'}</PT>
      </PostIt>
      <FolderTabs value={tab} onChange={setTab} tabs={[
        { id: 'score', label: 'Stamps', icon: 'stamp', color: 'pink' },
        { id: 'hunts', label: 'Hunts', icon: 'camera', color: 'orange' },
        { id: 'board', label: 'Leaderboard', icon: 'trophy', color: 'green' },
        { id: 'games', label: 'Games', icon: 'gamepad', color: 'lavender', badge: gameInvites.length > 0 },
      ]} />
      {tab === 'score' ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {STAMPS.map((s, i) => (
              <View key={s.id} style={{ width: '31%', alignItems: 'center', marginBottom: 14 }}>
                <StampThunk play={false}><RubberStamp label={s.label} color={s.color} size={84} tilt={i % 2 ? 6 : -8} faded={!stamps.has(s.id)} /></StampThunk>
                {!stamps.has(s.id) ? <T kind="small" style={{ fontSize: 10.5, textAlign: 'center', marginTop: 4 }} numberOfLines={2}>{s.hint}</T> : null}
              </View>
            ))}
          </View>
          {(play?.recent || []).length ? (
            <Card>
              <T kind="tiny" style={{ marginBottom: 4 }}>Recent points</T>
              {play.recent.map((r, i) => <Row key={`${r.at}-${i}`} title={r.label || 'Points'} right={<T kind="num" color={t.ok}>+{r.points}</T>} last={i === play.recent.length - 1} />)}
            </Card>
          ) : null}
          <Button title="My semester scrapbook" icon="book" kind="ghost" small onPress={() => setSheet({ type: 'scrapbook' })} style={{ marginTop: 14, alignSelf: 'flex-start' }} />
        </>
      ) : null}
      {tab === 'hunts' ? (
        !play ? <Loading /> : play.hunts.length ? play.hunts.map((h) => <Hunt key={h.id} h={h} />) : <Empty icon="camera" title="No hunt running right now" />
      ) : null}
      {tab === 'board' ? <Leaderboard /> : null}
      {tab === 'games' ? (
        <>
          {gameInvites.map((g) => (
            <PostIt key={g.id} color="lavender" seed={g.id} style={{ marginBottom: 12 }} onPress={() => setSheet({ type: 'game', id: g.id })}>
              <PT kind="bold">{g.cards?.[g.host]?.name || 'A friend'} invited you to hide and seek</PT><PT kind="small">Tap to join</PT>
            </PostIt>
          ))}
          {liveGames.map((g) => <Row key={g.id} title="Hide and seek" meta={`${g.players.length} players · ${g.status === 'lobby' ? 'waiting to start' : 'live now'}`} left={<Icon name="gamepad" />} onPress={() => setSheet({ type: 'game', id: g.id })} />)}
          <Card style={{ marginTop: 10 }}>
            <T kind="title" style={{ fontSize: 19 }}>Hide and seek</T>
            <T kind="small" style={{ marginTop: 2 }}>Friends only, on campus, up to an hour. Seekers get hot-or-cold hints, never a map. Tag a hider by scanning the code on their phone.</T>
            <Button title="Start a game" icon="gamepad" small onPress={() => setSheet({ type: 'gameNew' })} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
          </Card>
          <SectionNote icon="sparkle">More games are on the way.</SectionNote>
        </>
      ) : null}
    </View>
  );
}

