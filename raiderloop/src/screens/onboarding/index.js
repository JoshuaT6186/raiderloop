import React from 'react';
import { useApp } from '../../state/AppContext';
import Welcome from './Welcome';
import Account from './Account';
import School from './School';
import Profile from './Profile';
import AvatarStep from './AvatarStep';
import Interests from './Interests';
import ScheduleStep from './ScheduleStep';
import Permissions from './Permissions';
import Tour from './Tour';

const MAP = {
  welcome: Welcome, account: Account, school: School, profile: Profile, avatar: AvatarStep,
  interests: Interests, schedule: ScheduleStep, permissions: Permissions, tour: Tour,
};

export default function Onboarding() {
  const { onboardStep } = useApp();
  const Step = MAP[onboardStep] || Welcome;
  return <Step />;
}
