/**
 * Admin (only for uids listed in Firestore config/app → admins):
 * reports, Discover posts held for review, org claims, deal ideas,
 * "looks out of date" notes, and recent app errors (sign-in problems
 * show up here first).
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Sheet, T, Card, Button, Loading, Empty } from '../ui/Paper';
import { FolderTabs } from '../ui/Kit';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

export function AdminSheet({ onClose }) {
  const { showToast } = useApp();
  const [tab, setTab] = useState('reports');
  const [q, setQ] = useState(null);
  const load = () => api.adminQueue({}).then((r) => setQ(r.data)).catch((e) => { setQ({}); showToast(e.message); });
  useEffect(() => { load(); }, []);
  const act = async (kind, id, action) => { try { await api.adminAction({ kind, id, action }); showToast('Done'); load(); } catch (e) { showToast(e.message); } };
  const Btns = ({ items }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{items.map(([label, fn, kind]) => <Button key={label} title={label} small kind={kind || 'ghost'} onPress={fn} style={{ marginRight: 8, marginBottom: 6 }} />)}</View>;
  const list = q ? q[tab] || [] : [];
  return (
    <Sheet title="Admin" hand="Only you can see this." onClose={onClose} height={0.96}>
      <FolderTabs small value={tab} onChange={setTab} tabs={[
        { id: 'reports', label: `Reports${q?.reports?.length ? ` ${q.reports.length}` : ''}`, color: 'pink' },
        { id: 'pending', label: `Held${q?.pending?.length ? ` ${q.pending.length}` : ''}`, color: 'yellow' },
        { id: 'claims', label: `Orgs${q?.claims?.length ? ` ${q.claims.length}` : ''}`, color: 'green' },
        { id: 'deals', label: 'Deals', color: 'blue' },
        { id: 'outdated', label: 'Outdated', color: 'orange' },
        { id: 'errors', label: 'Errors', color: 'lavender' },
      ]} />
      {!q ? <Loading /> : !list.length ? <Empty icon="check" title="Nothing here" /> : list.map((x) => (
        <Card key={x.id} style={{ marginBottom: 10 }}>
          {tab === 'reports' ? (
            <>
              <T kind="tiny">{x.kind} · {when(x.at)}</T>
              <T kind="bold">{x.reason || 'No reason'}</T>
              {x.note ? <T kind="small">{x.note}</T> : null}
              <T kind="small">Target {x.targetId || '—'} · user {x.targetUid || '—'}</T>
              <Btns items={[['Remove content', () => act('report', x.id, 'remove'), 'danger'], ['Ban user', () => act('report', x.id, 'ban'), 'danger'], ['Dismiss', () => act('report', x.id, 'dismiss')]]} />
            </>
          ) : null}
          {tab === 'pending' ? (
            <>
              <T kind="tiny">{x.kind} · {x.name}</T>
              <T kind="bold">{x.title}</T>
              {x.body ? <T kind="small">{x.body}</T> : null}
              <Btns items={[['Approve', () => act('publicPost', x.id, 'approve'), 'primary'], ['Reject', () => act('publicPost', x.id, 'reject'), 'danger']]} />
            </>
          ) : null}
          {tab === 'claims' ? (
            <>
              <T kind="bold">{x.orgName}</T>
              <T kind="small">{x.role}{x.email ? ` · ${x.email}` : ''}</T>
              {x.note ? <T kind="small">{x.note}</T> : null}
              <Btns items={[['Approve', () => act('orgClaim', x.id, 'approve'), 'primary'], ['Reject', () => act('orgClaim', x.id, 'reject'), 'danger']]} />
            </>
          ) : null}
          {tab === 'deals' ? (
            <>
              <T kind="bold">{x.name || x.place || 'Deal idea'}</T>
              <T kind="small">{x.offer || x.note || JSON.stringify(x).slice(0, 140)}</T>
              <T kind="small">Add it in Firestore → deals if it checks out.</T>
              <Btns items={[['Dismiss', () => act('deal', x.id, 'dismiss')]]} />
            </>
          ) : null}
          {tab === 'outdated' ? (
            <>
              <T kind="bold">{x.title || x.itemId}</T>
              {x.note ? <T kind="small">{x.note}</T> : null}
              {x.url ? <T kind="small">{x.url}</T> : null}
              <Btns items={[['Fixed', () => act('outdated', x.id, 'resolve'), 'primary']]} />
            </>
          ) : null}
          {tab === 'errors' ? (
            <>
              <T kind="tiny">{x.where} · {x.platform} {x.os} · v{x.app} · {when(x.at)}</T>
              <T kind="bold">{x.code || 'error'}</T>
              <T kind="small">{x.message}</T>
            </>
          ) : null}
        </Card>
      ))}
    </Sheet>
  );
}
