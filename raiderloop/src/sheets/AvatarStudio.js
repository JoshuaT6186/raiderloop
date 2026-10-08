/**
 * Avatar Studio — build your doodle. Used inline in onboarding and
 * as a sheet from You. Plus-only items show a crown and stay
 * previewable, but can't be saved without Flyer Plus.
 */
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { T, Chip, Button, Sheet, PostIt } from '../ui/Paper';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import {
  SKIN, HAIR_COLORS, SHIRT_COLORS, HAIR_STYLES, EYES, MOUTHS, FACIAL_HAIR, ACCESSORIES, HATS, SHIRTS, BACKGROUNDS, randomAvatar,
} from '../ui/avatarParts';

const TABS = [
  { id: 'face', label: 'Face', icon: 'you' },
  { id: 'hair', label: 'Hair', icon: 'sparkle' },
  { id: 'fit', label: 'Fit', icon: 'tag' },
  { id: 'extras', label: 'Extras', icon: 'star' },
];

function Swatches({ colors, value, onPick, label }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <T kind="tiny" style={{ marginBottom: 8 }}>{label}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {colors.map((c) => (
          <Pressable key={c} onPress={() => onPick(c)} accessibilityLabel={`${label} ${c}`}
            style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, marginRight: 9, marginBottom: 9, borderWidth: value === c ? 3 : 1.5, borderColor: value === c ? '#1F2A44' : 'rgba(31,42,68,0.25)' }} />
        ))}
      </View>
    </View>
  );
}

function Options({ items, value, onPick, label, isPlus }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <T kind="tiny" style={{ marginBottom: 8 }}>{label}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {items.map((o) => (
          <Chip key={o.id} label={o.plus && !isPlus ? `${o.label} ★` : o.label} active={value === o.id} onPress={() => onPick(o.id)} />
        ))}
      </View>
    </View>
  );
}

export function AvatarStudio({ value, onChange, isPlus }) {
  const { t } = useTheme();
  const [tab, setTab] = useState('face');
  const set = (patch) => onChange({ ...value, ...patch });
  const lockedPick = [...HATS, ...SHIRTS].filter((o) => o.plus).map((o) => o.id);
  const usesLocked = !isPlus && (lockedPick.includes(value.hat) || lockedPick.includes(value.shirt));

  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: 14 }}>
        <PostIt color={value.bg} tilt={-2} tape padding={16}>
          <Avatar config={value} size={150} />
        </PostIt>
        <Pressable onPress={() => onChange(randomAvatar())} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }} accessibilityRole="button">
          <Icon name="refresh" size={18} color={t.accent} />
          <T kind="hand" color={t.accent} style={{ marginLeft: 6 }}>surprise me</T>
        </Pressable>
        {usesLocked ? <T kind="small" color={t.warn} style={{ marginTop: 6 }}>★ items need Flyer Plus to save. They'll swap back if you continue.</T> : null}
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        {TABS.map((x) => (
          <Pressable key={x.id} onPress={() => setTab(x.id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 3, borderColor: tab === x.id ? t.accent : 'transparent' }}>
            <Icon name={x.icon} size={18} color={tab === x.id ? t.accent : t.pencil} />
            <T kind="small" color={tab === x.id ? t.accent : t.pencil}>{x.label}</T>
          </Pressable>
        ))}
      </View>

      {tab === 'face' ? (
        <View>
          <Swatches label="Skin" colors={SKIN} value={value.skin} onPick={(skin) => set({ skin })} />
          <Options label="Eyes" items={EYES} value={value.eyes} onPick={(eyes) => set({ eyes })} />
          <Options label="Mouth" items={MOUTHS} value={value.mouth} onPick={(mouth) => set({ mouth })} />
          <Options label="Blush" items={[{ id: 'on', label: 'On' }, { id: 'off', label: 'Off' }]} value={value.blush ? 'on' : 'off'} onPick={(v) => set({ blush: v === 'on' })} />
        </View>
      ) : null}
      {tab === 'hair' ? (
        <View>
          <Options label="Style" items={HAIR_STYLES} value={value.hair} onPick={(hair) => set({ hair })} />
          <Swatches label="Color" colors={HAIR_COLORS} value={value.hairColor} onPick={(hairColor) => set({ hairColor })} />
          <Options label="Facial hair" items={FACIAL_HAIR} value={value.facialHair} onPick={(facialHair) => set({ facialHair })} />
        </View>
      ) : null}
      {tab === 'fit' ? (
        <View>
          <Options label="Top" items={SHIRTS} value={value.shirt} onPick={(shirt) => set({ shirt })} isPlus={isPlus} />
          <Swatches label="Color" colors={SHIRT_COLORS} value={value.shirtColor} onPick={(shirtColor) => set({ shirtColor })} />
          {value.shirt === 'jersey' ? (
            <Options label="Number" items={['1', '7', '10', '12', '23', '26', '30', '99'].map((n) => ({ id: n, label: `#${n}` }))} value={value.number} onPick={(number) => set({ number })} />
          ) : null}
        </View>
      ) : null}
      {tab === 'extras' ? (
        <View>
          <Options label="Hat" items={HATS} value={value.hat} onPick={(hat) => set({ hat })} isPlus={isPlus} />
          <Options label="Accessory" items={ACCESSORIES} value={value.accessory} onPick={(accessory) => set({ accessory })} />
          <T kind="tiny" style={{ marginBottom: 8 }}>Sticky note</T>
          <View style={{ flexDirection: 'row' }}>
            {BACKGROUNDS.map((c) => (
              <Pressable key={c} onPress={() => set({ bg: c })} accessibilityLabel={`Background ${c}`}
                style={{ width: 38, height: 38, marginRight: 9, backgroundColor: t.postit[c], borderWidth: value.bg === c ? 3 : 1.5, borderColor: value.bg === c ? '#1F2A44' : 'rgba(31,42,68,0.2)', transform: [{ rotate: '-3deg' }] }} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* Strip Plus-only parts if the user doesn't have Plus. */
export function sanitizeAvatar(a, isPlus) {
  if (isPlus) return a;
  const locked = [...HATS, ...SHIRTS].filter((o) => o.plus).map((o) => o.id);
  return { ...a, hat: locked.includes(a.hat) ? 'none' : a.hat, shirt: locked.includes(a.shirt) ? 'hoodie' : a.shirt };
}

export default function AvatarSheet({ value, isPlus, onSave, onClose }) {
  const [draft, setDraft] = useState(value);
  return (
    <Sheet title="Your avatar" hand="This is how friends see you on the map." onClose={onClose}
      footer={<Button title="Save avatar" icon="check" onPress={() => onSave(sanitizeAvatar(draft, isPlus))} />}>
      <AvatarStudio value={draft} onChange={setDraft} isPlus={isPlus} />
    </Sheet>
  );
}
