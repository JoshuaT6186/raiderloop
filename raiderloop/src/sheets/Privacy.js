/**
 * "What Flyer knows about you": everything on this phone, everything
 * on Flyer's servers, who sees what, and a delete button for each.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Share } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Row, Toggle, Loading, Divider,
} from '../ui/Paper';
import { FolderTabs, SectionNote } from '../ui/Kit';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { forgetAllSecrets } from '../lib/connectors';
import { useSayHiSync } from './SayHi';

function Line({ icon, title, meta, onDelete, last }) {
  const { t } = useTheme();
  return (
    <Row title={title} meta={meta} last={last} left={<Icon name={icon} color={t.ink} />}
      right={onDelete ? <T kind="hand" color={t.redPen} onPress={onDelete}>delete</T> : null} />
  );
}

export function PrivacySheet({ onClose }) {
  const { t } = useTheme();
  const app = useApp();
  const { user, set, showToast, sayHiVisible, postcardsToFriends, leaderboardPublic } = app;
  const [tab, setTab] = useState('who');
  const [server, setServer] = useState(null);
  const sync = useSayHiSync();
  const signedIn = user && !user.isAnonymous;
  const load = () => (user ? api.myData({}).then((r) => setServer(r.data)).catch(() => setServer({})) : setServer({}));
  useEffect(() => { load(); }, [user?.uid]);

  const confirm = (title, body, fn) => Alert.alert(title, body, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: fn }]);
  const delServer = (what, label) => confirm(`Delete ${label}?`, "This removes it from Flyer's servers. It can't be undone.", async () => {
    try { await api.deleteMyData({ what }); showToast('Deleted'); if (what === 'sayhi') set({ sayHiVisible: false }); load(); } catch (e) { showToast(e.message); }
  });
  const delLocal = (patch, label) => confirm(`Clear ${label} on this phone?`, "This only clears this phone. It can't be undone.", () => { set(patch); showToast('Cleared'); });
  const exportLocal = () => {
    const keys = ['userName', 'userMajor', 'userClassYear', 'interests', 'scheduleItems', 'assignments', 'gradeCourses', 'savedEvents', 'followedOrgIds', 'jobApps', 'applyProfile', 'syllabi', 'roadmap', 'firstWeeks'];
    const out = Object.fromEntries(keys.map((k) => [k, app[k]]));
    Share.share({ message: JSON.stringify(out, null, 2) }).catch(() => {});
  };
  const c = server?.counts || {};
  return (
    <Sheet title="What Flyer knows" hand="Everything, in one place. Delete anything." onClose={onClose} height={0.95}>
      <FolderTabs small value={tab} onChange={setTab} tabs={[
        { id: 'who', label: 'Who sees what', icon: 'eye', color: 'green' },
        { id: 'phone', label: 'This phone', icon: 'phone', color: 'yellow' },
        { id: 'cloud', label: 'Our servers', icon: 'cloud', color: 'blue' },
      ]} />

      {tab === 'who' ? (
        <>
          <PostIt color="green" tape tilt={-0.6}>
            <PT kind="tiny">Everyone at school</PT><PT kind="bold">Avatar, name, major, and card fields you set to Everyone</PT>
            <PT kind="tiny" style={{ marginTop: 10 }}>After a Say hi</PT><PT kind="bold">+ the classes and orgs you share</PT>
            <PT kind="tiny" style={{ marginTop: 10 }}>Friends</PT><PT kind="bold">+ face photo, Story, posts, Postcards, and the rest of your card</PT>
            <PT kind="tiny" style={{ marginTop: 10 }}>Only you</PT><PT kind="bold">Your schedule, grades, assignments, jobs tracker, College Journey, health data</PT>
          </PostIt>
          <Card style={{ marginTop: 16 }}>
            <Row title="Show me in Say hi suggestions" meta="Only people who share a class or org, and also turned this on" right={<Toggle value={sayHiVisible} onChange={async (v) => { try { await sync(v); set({ sayHiVisible: v }); } catch (e) { showToast(e.message); } }} label="Show me in Say hi suggestions" />} />
            <Row title="Friends see my Postcards on the map" right={<Toggle value={postcardsToFriends} onChange={async (v) => { set({ postcardsToFriends: v }); api.setPrivacyPrefs({ postcardsToFriends: v }).catch(() => {}); }} label="Friends see my Postcards" />} />
            <Row title="Show me on the campus leaderboard" meta="Off = only friends see your Flight Score" right={<Toggle value={leaderboardPublic} onChange={async (v) => { set({ leaderboardPublic: v }); api.setLeaderboard({ public: v }).catch(() => {}); }} label="Show me on the campus leaderboard" />} />
            <Row title="Visible for Flyer Drop nearby" meta="Only while you have the Drop screen open. Never in the background." left={null} last />
          </Card>
          <SectionNote icon="lock">Location is only ever used while Flyer is open on your screen. Health data is read on your phone and never leaves it.</SectionNote>
        </>
      ) : null}

      {tab === 'phone' ? (
        <>
          <Card>
            <Line icon="schedule" title="Class schedule" meta={`${app.scheduleItems.length} items`} onDelete={() => delLocal({ scheduleItems: [] }, 'your schedule')} />
            <Line icon="clipboard" title="Assignments" meta={`${app.assignments.length} items`} onDelete={() => delLocal({ assignments: [] }, 'your assignments')} />
            <Line icon="percent" title="Grades" meta={`${app.gradeCourses.length} courses`} onDelete={() => delLocal({ gradeCourses: [], priorGpa: '', priorCredits: '' }, 'your grades')} />
            <Line icon="bookmark" title="Saved events" meta={`${app.savedEvents.length}`} onDelete={() => delLocal({ savedEvents: [] }, 'saved events')} />
            <Line icon="briefcase" title="Jobs tracker + apply-once profile" meta={`${app.jobApps.length} jobs`} onDelete={() => delLocal({ jobApps: [], applyProfile: { resume: '', availability: [], hours: '', skills: '', references: [] } }, 'your jobs tracker')} />
            <Line icon="book" title="Syllabi, roadmap, first-30-days" meta={`${app.syllabi.length} syllabi · ${app.roadmap.done.length} courses done`} onDelete={() => delLocal({ syllabi: [], roadmap: { major: '', done: [] }, firstWeeks: { on: null, done: [], startedAt: null } }, 'those notes')} />
            <Line icon="key" title="Connections (keys and calendar links)" meta="Kept in the iPhone Keychain" onDelete={() => confirm('Remove every connection?', 'Canvas, Microsoft, Google, Canva and calendar links on this phone.', async () => { await forgetAllSecrets(); set({ feeds: [], connections: { ...app.connections, canvasToken: false, microsoft: false, google: false, canva: false } }); showToast('Removed'); })} />
            <Line icon="heart" title="Apple Health" meta={app.connections.health ? 'Read on this phone only, never saved or sent' : 'Not connected'} last />
          </Card>
          <Row title="Export this phone's Flyer data" meta="As text you can save or send" left={<Icon name="share" color={t.ink} />} onPress={exportLocal} last />
        </>
      ) : null}

      {tab === 'cloud' ? (
        !server ? <Loading /> : !signedIn ? (
          <Card><T kind="small">You're browsing as a guest, so Flyer's servers only hold anonymous usage counts (to keep limits fair) and anything you asked Pilot today.</T></Card>
        ) : (
          <>
            <Card>
              <Line icon="you" title="Profile" meta={`${server.profile?.name || 'No name'} · @${server.profile?.handle || ''}`} />
              <Line icon="qr" title="Connect card" meta={`${server.card?.fields || 0} fields${server.card?.face ? ' · face photo' : ''}`} onDelete={() => delServer('card', 'your card and face photo')} />
              <Line icon="hand" title="Say hi" meta={server.sayHi ? `${server.sayHi.courses} classes · ${server.sayHi.orgs} orgs · ${c.intros || 0} hellos` : 'Off'} onDelete={server.sayHi || c.intros ? () => delServer('sayhi', 'Say hi') : null} />
              <Line icon="image" title="Posts and Postcards" meta={`${c.posts || 0} posts · ${c.saved || 0} in your Story`} onDelete={c.posts ? () => delServer('posts', 'every post and photo') : null} />
              <Line icon="megaphone" title="Discover posts" meta={`${c.publicPosts || 0}`} onDelete={c.publicPosts ? () => delServer('public', 'your Discover posts') : null} />
              <Line icon="book" title="Class notes you shared" meta={`${c.notes || 0}`} onDelete={c.notes ? () => delServer('notes', 'your shared notes') : null} />
              <Line icon="location" title="Location sharing" meta={server.location ? `Sharing with ${server.location.sharingWith}` : 'Off'} onDelete={server.location ? () => delServer('location', 'your shared location') : null} />
              <Line icon="cap" title="Find classmates" meta={server.classmates ? `${server.classmates} course codes` : 'Off'} onDelete={server.classmates ? () => delServer('classmates', 'your classmates listing') : null} />
              <Line icon="trophy" title="Flight Score" meta={server.score ? `${server.score.points} points · ${server.score.stamps} stamps` : 'None yet'} onDelete={server.score ? () => delServer('score', 'your Flight Score') : null} />
              <Line icon="bell" title="Push notifications" meta={`${server.pushDevices || 0} devices`} onDelete={server.pushDevices ? () => delServer('push', 'push tokens') : null} />
              <Line icon="users" title="Friends, groups, drops" meta={`${c.friends || 0} friends · ${c.groups || 0} groups · ${c.drops || 0} drops sent`} />
              <Line icon="flag" title="Reports you made" meta={`${c.reports || 0}`} last />
            </Card>
            <Divider />
            <T kind="small">Your whole account (and everything above) can be deleted in You → Settings → Delete account. Flyer never sells your data, and never shares your schedule, location, friends, or health data with advertisers.</T>
          </>
        )
      ) : null}
    </Sheet>
  );
}
