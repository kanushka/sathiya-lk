// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useTranslation } from 'react-i18next';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
import { PageTitle, PrintIconLink, SnapshotGate, printTimetablePath } from './parts';
import { useTeacherData } from './teacherData';
import { ModeSwitch, TimetableView, useTimetableState } from './TimetableView';

export function TimetablePage() {
  return <SnapshotGate>{() => <TimetableBody />}</SnapshotGate>;
}

function TimetableBody() {
  const { t } = useTranslation('teacher');
  const { sid } = useTeacherData();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const state = useTimetableState(isPhone ? '3days' : 'week');
  return (
    <div className="flex flex-col gap-2.5">
      <PageTitle title={t('timetable.title')} action={<PrintIconLink to={printTimetablePath(sid)} label={t('timetable.print')} />} />
      <ModeSwitch value={state.mode} onChange={state.setMode} className="w-full md:w-[360px]" />
      <div className="md:rounded-[14px] md:border md:border-line md:bg-white md:p-4">
        <TimetableView mode={state.mode} start={state.start} onStart={state.setStart} compactWeek={isPhone} />
      </div>
    </div>
  );
}
