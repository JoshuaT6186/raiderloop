/**
 * "Right now" status taps: one tap to say the printer's out, the
 * elevator's down, the line is long, or the lot is full. Reports fade
 * after 30 minutes, so what you see is always recent. Elevator reports
 * matter most for anyone who needs an accessible route.
 */
import React, { useEffect, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { T } from '../ui/Paper';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, listenDoc } from '../lib/firebase';
import { tap } from '../lib/native';

export const STATUS = {
  elevator: { icon: 'elevator', name: 'Elevator', values: [['working', 'Working', 'green'], ['out', 'Out', 'pink']] },
  printer: { icon: 'printer', name: 'Printer', values: [['working', 'Working', 'green'], ['out', 'Out', 'pink']] },
  line: { icon: 'hourglass', name: 'Line', values: [['short', 'Short', 'green'], ['medium', 'Medium', 'yellow'], ['long', 'Long', 'pink']] },
  seats: { icon: 'chair', name: 'Seats', values: [['plenty', 'Plenty', 'green'], ['few', 'A few', 'yellow'], ['full', 'Full', 'pink']] },
  lot: { icon: 'parking', name: 'Lot', values: [['open', 'Spots open', 'green'], ['filling', 'Filling up', 'yellow'], ['full', 'Full', 'pink']] },
  wifi: { icon: 'wifi', name: 'Wi-Fi', values: [['good', 'Good', 'green'], ['spotty', 'Spotty', 'yellow'], ['down', 'Down', 'pink']] },
};
const FRESH = 30 * 60000;
const ago = (ms) => { const m = Math.max(1, Math.round((Date.now() - ms) / 60000)); return m < 60 ? `${m} min ago` : 'a while ago'; };

/** The freshest value for each kind, or null if nothing recent. */
export function freshStatus(doc, kind) {
  const v = doc && doc[kind];
  if (!v || !v.at || Date.now() - v.at > FRESH) return null;
  return v;
}

export function StatusTaps({ placeId, kinds = ['elevator', 'printer', 'seats'] }) {
  const { t, f } = useTheme();
  const { showToast, user } = useApp();
  const [doc, setDoc] = useState(null);
  const [sent, setSent] = useState({});
  useEffect(() => (placeId ? listenDoc(`status/${placeId}`, setDoc) : undefined), [placeId]);
  const send = async (kind, value) => {
    tap();
    setSent((p) => ({ ...p, [kind]: value }));
    try { await api.tapStatus({ placeId, kind, value }); showToast('Thanks, that helps everyone'); } catch (e) { showToast(e.message || "Couldn't send that."); }
  };
  if (!user) return null;
  return (
    <View>
      {kinds.map((k) => {
        const cfg = STATUS[k];
        const cur = freshStatus(doc, k);
        const curCfg = cur && cfg.values.find((v) => v[0] === cur.value);
        return (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderColor: t.rule, borderStyle: 'dashed' }}>
            <Icon name={cfg.icon} size={20} color={t.ink} />
            <View style={{ width: 92, marginLeft: 8 }}>
              <T kind="bold" style={{ fontSize: 14 }}>{cfg.name}</T>
              <T kind="small" style={{ fontSize: 11.5 }} color={curCfg && curCfg[2] === 'pink' ? t.redPen : t.pencil}>{cur ? `${curCfg ? curCfg[1] : cur.value} · ${ago(cur.at)}` : 'no reports'}</T>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
              {cfg.values.map(([id, label, color]) => (
                <Pressable key={id} onPress={() => send(k, id)} accessibilityRole="button" accessibilityLabel={`${cfg.name}: ${label}`}
                  style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, marginLeft: 6, marginVertical: 2, borderWidth: 1.5, borderColor: sent[k] === id ? '#1F2A44' : t.border, backgroundColor: sent[k] === id ? t.postit[color] : 'transparent' }}>
                  <Text style={{ fontFamily: f.bodyBold, fontSize: 12, color: sent[k] === id ? '#1F2A44' : t.inkSoft }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
