/**
 * Planner — your notebook, with folder tabs: Classes, Due, Week
 * (busiest week + connected calendars), Groups, GPA, and Finals.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Page } from '../ui/Page';
import { IconButton, Button, PostIt, PT } from '../ui/Paper';
import { FolderTabs } from '../ui/Kit';
import { useApp } from '../state/AppContext';
import Classes from './planner/Classes';
import Assignments from './planner/Assignments';
import Week from './planner/Week';
import Grades from './planner/Grades';
import Finals from './planner/Finals';
import { GroupsBody } from '../sheets/Groups';

function GroupsTab() {
  const { setSheet, user } = useApp();
  if (!user || user.isAnonymous) {
    return (
      <PostIt color="yellow" tape style={{ marginTop: 6 }}>
        <PT kind="bold">Group Spaces need an account</PT>
        <PT kind="small">Shared deadlines, files, polls, and a free-time finder for every project.</PT>
        <Button title="Make an account" small onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      </PostIt>
    );
  }
  return (
    <View>
      <Button title="New group" icon="plus" onPress={() => setSheet({ type: 'groupNew' })} style={{ marginTop: 4, marginBottom: 14 }} />
      <GroupsBody />
    </View>
  );
}

export default function Planner() {
  const { assignments, setSheet, flags, groupInvites } = useApp();
  const [tab, setTab] = useState('classes');
  const overdue = assignments.some((a) => !a.done && a.due && new Date(a.due) < new Date());
  return (
    <Page eyebrow="your notebook" title="Planner" paper="graph"
      right={flags.courses ? <IconButton name="search" label="Look up a class or book a study room" onPress={() => setSheet({ type: 'course' })} /> : null}>
      <FolderTabs small value={tab} onChange={setTab} tabs={[
        { id: 'classes', label: 'Classes', icon: 'schedule', color: 'blue' },
        { id: 'due', label: 'Due', icon: 'clipboard', color: 'yellow', badge: overdue },
        { id: 'week', label: 'Week', icon: 'calendarPlus', color: 'orange' },
        { id: 'groups', label: 'Groups', icon: 'users', color: 'pink', badge: groupInvites.length > 0 },
        { id: 'gpa', label: 'GPA', icon: 'percent', color: 'green' },
        { id: 'finals', label: 'Finals', icon: 'cap', color: 'lavender' },
      ]} />
      {tab === 'classes' ? <Classes /> : null}
      {tab === 'due' ? <Assignments /> : null}
      {tab === 'week' ? <Week /> : null}
      {tab === 'groups' ? <GroupsTab /> : null}
      {tab === 'gpa' ? <Grades /> : null}
      {tab === 'finals' ? <Finals /> : null}
    </Page>
  );
}
