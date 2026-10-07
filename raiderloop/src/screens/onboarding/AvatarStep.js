import React, { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { Button } from '../../ui/Paper';
import { Shell, Heading } from './Shell';
import { AvatarStudio, sanitizeAvatar } from '../../sheets/AvatarStudio';

export default function AvatarStep() {
  const { set, avatar, isPlus } = useApp();
  const [draft, setDraft] = useState(avatar);
  return (
    <Shell step="avatar" onBack={() => set({ onboardStep: 'profile' })}
      footer={<Button title="Looks good" icon="check" onPress={() => set({ avatar: sanitizeAvatar(draft, isPlus), onboardStep: 'interests' })} />}>
      <Heading eyebrow="step four" title="Draw yourself" sub="Friends see this on the map and in their list. You can change it any time." />
      <AvatarStudio value={draft} onChange={setDraft} isPlus={isPlus} />
    </Shell>
  );
}
