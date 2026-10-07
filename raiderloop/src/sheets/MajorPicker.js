import React, { useMemo, useState } from 'react';
import { Sheet, Field, Row, T } from '../ui/Paper';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { MAJORS } from '../data/majors';

export default function MajorPicker({ value, onSelect, onClose }) {
  const { t } = useTheme();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? MAJORS.filter((m) => m.toLowerCase().includes(s)) : MAJORS).concat(s ? [] : ['Undecided / Exploring']);
  }, [q]);
  return (
    <Sheet title="Pick your major" hand={`${MAJORS.length} real majors from ttu.edu`} onClose={onClose}>
      <Field placeholder="Search majors…" value={q} onChangeText={setQ} autoFocus />
      {list.map((m, i) => (
        <Row key={m} title={m} last={i === list.length - 1} onPress={() => onSelect(m)} chevron={false}
          right={value === m ? <Icon name="check" color={t.ok} /> : null} />
      ))}
      {!list.length ? <T kind="small">No major matches "{q}".</T> : null}
    </Sheet>
  );
}
