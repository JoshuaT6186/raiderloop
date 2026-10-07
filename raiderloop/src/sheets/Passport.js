/**
 * Flight passport — your stamps, score, title, and the friend board.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Sheet, T, PostIt, PT, Card, Row, Toggle, Empty, Loading, Divider } from '../ui/Paper';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, errText } from '../lib/firebase';
import { FLIGHT, levelFor, tierLabel, STAMP_COLORS, placeById } from '../data/places';

const SHORT = { game: 'GAME DAY', event: 'EVENT', rec: 'REC', spot: 'NEW SPOT', dining: 'DINING' };
function Stamp({ s, onPress }) {
  const color = s.routine ? '#8A8577' : STAMP_COLORS[s.tier] || '#2E8256';
  const tilt = ((s.name || '').length % 7) - 3;
  return (
    <Pressable onPress={onPress} style={{ width: '33.3%', alignItems: 'center', marginBottom: 14 }} accessibilityLabel={`${s.name}, ${tierLabel(s.tier)}`}>
      <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: color, borderStyle: s.routine ? 'dashed' : 'solid', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${tilt * 2}deg` }], backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 6 }}>
        <T kind="tiny" color={color} style={{ textAlign: 'center', fontSize: 9.5 }} numberOfLines={1}>{s.routine ? 'CLASS' : SHORT[s.tier] || 'SPOT'}</T>
        <T kind="marker" color={color} style={{ fontSize: 18, lineHeight: 22 }}>{s.visits > 1 ? `×${s.visits}` : '✓'}</T>
      </View>
      <T kind="small" style={{ textAlign: 'center', marginTop: 4, fontSize: 12 }} numberOfLines={2}>{s.name}</T>
    </Pressable>
  );
}

function Board() {
  const { t } = useTheme();
  const [state, setState] = useState({ loading: true, board: [], error: null });
  useEffect(() => {
    api.getFlightBoard({}).then((r) => setState({ loading: false, board: r.data.board || [], error: null }))
      .catch((e) => setState({ loading: false, board: [], error: errText(e) }));
  }, []);
  if (state.loading) return <Loading label="Lining up the flock…" />;
  if (state.error) return <T kind="small">{state.error}</T>;
  if (state.board.length <= 1) return <T kind="small">No friends are showing their score yet. It's opt-in, so ask them to turn on "Show my score to friends".</T>;
  return (
    <Card>
      {state.board.map((r, i) => (
        <Row key={r.uid} title={`${i + 1}. ${r.me ? 'You' : r.name}`} meta={r.title} left={<Avatar config={r.avatar} size={36} />}
          right={<T kind="num" color={r.me ? t.accent : t.ink}>{r.score}</T>} last={i === state.board.length - 1} />
      ))}
    </Card>
  );
}

export default function PassportSheet({ onClose }) {
  const { t } = useTheme();
  const { flight, user, showToast, goToBuilding, setTab } = useApp();
  const [showScore, setShowScore] = useState(!!flight.showScore);
  useEffect(() => setShowScore(!!flight.showScore), [flight.showScore]);
  const score = flight.score || 0;
  const lvl = levelFor(score);
  const stamps = useMemo(() => Object.entries(flight.stamps || {}).map(([id, s]) => ({ id, ...s })).sort((a, b) => (b.first || 0) - (a.first || 0)), [flight.stamps]);
  const real = stamps.filter((s) => !s.routine);
  const week = flight.week ? flight.weekPts || 0 : 0;
  const signedIn = user && !user.isAnonymous;

  const toggleShow = async (v) => {
    setShowScore(v);
    try { await api.setFlightPrefs({ showScore: v }); } catch (e) { setShowScore(!v); showToast(errText(e)); }
  };

  return (
    <Sheet title="Flight passport" hand="Go somewhere new. Fill the pages." onClose={onClose} height={0.94}>
      {!signedIn ? (
        <PostIt color="yellow" tilt={-1} tape>
          <PT kind="title">Stamps need an account</PT>
          <PT kind="small" style={{ marginTop: 4 }}>So your score is really yours.</PT>
        </PostIt>
      ) : (
        <>
          <PostIt color="yellow" tilt={-1.2} tape padding={16}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                <PT kind="tiny">Flight score</PT>
                <T kind="marker" color="#1F2A44" style={{ fontSize: 50, lineHeight: 56 }}>{score}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T kind="handBig" color="#1F2A44">{lvl.title}</T>
                <PT kind="small">{lvl.next ? `${lvl.toNext} to ${lvl.next.title}` : 'Top of the sky'}</PT>
              </View>
            </View>
            <View style={{ height: 12, borderWidth: 2, borderColor: '#1F2A44', borderRadius: 8, backgroundColor: '#fff', marginTop: 10, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(lvl.progress * 100)}%`, height: '100%', backgroundColor: t.accent }} />
            </View>
            <PT kind="small" style={{ marginTop: 8 }}>{real.length} {real.length === 1 ? 'place' : 'places'} stamped · {week} of {FLIGHT.caps.pointsPerWeek} points this week</PT>
          </PostIt>

          <T kind="tiny" style={{ marginTop: 18, marginBottom: 8 }}>How to earn</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {[['game', 'Home games'], ['event', 'Campus events'], ['rec', 'Rec, arenas & parks'], ['spot', 'New buildings'], ['dining', 'New dining spots']].map(([k, label]) => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: STAMP_COLORS[k], borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8, marginBottom: 8 }}>
                <T kind="bold" style={{ fontSize: 13 }}>{label}</T>
                <T kind="bold" color={STAMP_COLORS[k]} style={{ marginLeft: 6, fontSize: 13 }}>+{FLIGHT.points[k]}</T>
              </View>
            ))}
          </View>
          <T kind="small">Meetups with friends: +{FLIGHT.points.meetup} each (+{FLIGHT.points.meetupBig} at the Rec or a game). Rating a place: +{FLIGHT.points.rating}. Your class buildings don't count — they're your routine. Up to {FLIGHT.caps.checkInsPerDay} check-ins a day.</T>
          <Row title="Find a place to check in" meta="Open the map and tap any building" left={<Icon name="campus" color={t.ink} />} onPress={() => { onClose(); setTab('campus'); }} last />

          <T kind="tiny" style={{ marginTop: 16, marginBottom: 10 }}>Your stamps</T>
          {stamps.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {stamps.map((s) => <Stamp key={s.id} s={s} onPress={() => { if (placeById(s.id)) { onClose(); goToBuilding(s.id); } }} />)}
            </View>
          ) : <Empty icon="passport" title="No stamps yet" body="Walk into a building you've never been to, tap it on the map, and check in." />}

          <Divider />
          <Row title="Show my score to friends" meta="Just your total and title — never where you've been" right={<Toggle value={showScore} onChange={toggleShow} label="Show my score to friends" />} last />
          <T kind="tiny" style={{ marginTop: 14, marginBottom: 8 }}>Friend board</T>
          <Board />
          <T kind="small" style={{ marginTop: 12 }}>Rewards are bragging rights: your title shows on the board, and it's all free. Check-ins use one location reading at the moment you tap — Flyer doesn't track you.</T>
        </>
      )}
    </Sheet>
  );
}
