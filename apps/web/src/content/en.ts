// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { CONTACT_EMAIL, SITE_HOST } from '../site';

export const en = {
  brand: 'Sathiya',
  skip: 'Skip to content',
  meta: {
    index: {
      title: 'Sathiya (සතිය) — Free school timetables for Sri Lanka',
      description:
        'Sathiya (සතිය) is a free timetable app for Sri Lankan schools. Build class and teacher timetables, catch clashes early, and give every teacher their week on their phone.',
    },
    terms: {
      title: 'Terms & Conditions · Sathiya (සතිය)',
      description: 'The terms for using Sathiya (සතිය), the free school timetable service for Sri Lankan schools.',
    },
    privacy: {
      title: 'Privacy Policy · Sathiya (සතිය)',
      description: 'What Sathiya (සතිය) collects, where it is stored, and who can see it.',
    },
    contact: {
      title: 'Contact · Sathiya (සතිය)',
      description: 'How to reach the people who run Sathiya (සතිය).',
    },
    guide: {
      title: 'Guides · Sathiya (සතිය)',
      description: 'Step-by-step guides and videos for using Sathiya (සතිය), the free school timetable app.',
    },
    'guide/register-school': {
      title: 'How to register your school · Sathiya (සතිය)',
      description: 'Register your school on Sathiya (සතිය) in about 3 minutes: school details, logo and colours, and your admin account.',
    },
    'guide/subjects': {
      title: 'How to add subjects · Sathiya (සතිය)',
      description: 'Set up one subject list for the whole school in Sathiya (සතිය), in Sinhala and English.',
    },
    'guide/grades': {
      title: 'How to set up grades and classes · Sathiya (සතිය)',
      description: 'Add grades, classes and weekly periods per subject in Sathiya (සතිය).',
    },
    'guide/templates': {
      title: 'How to set up period templates · Sathiya (සතිය)',
      description: 'Set your school bell schedule, periods and intervals in Sathiya (සතිය).',
    },
    'guide/teachers': {
      title: 'How to add and edit teachers · Sathiya (සතිය)',
      description: 'Add teachers with staff IDs, subjects, grades and daily limits in Sathiya (සතිය).',
    },
    'guide/timetable-class': {
      title: 'How to build the timetable by class · Sathiya (සතිය)',
      description: 'Place lessons class by class in Sathiya (සතිය), with teacher clashes prevented.',
    },
    '404': {
      title: 'Page not found · Sathiya (සතිය)',
      description: `This page does not exist on ${SITE_HOST}.`,
    },
  },
  notFound: {
    title: 'Page not found',
    body: 'Sorry, we could not find that page. It may have moved, or the link may be wrong.',
    home: 'Go to the home page',
  },
  nav: {
    label: 'Main',
    features: 'Features',
    how: 'How it works',
    faq: 'FAQ',
    guides: 'Guides',
    login: 'Log in',
    register: 'Register school',
    menu: 'Menu',
    language: 'Language',
    sinhala: 'සිංහල',
    english: 'English',
  },
  hero: {
    pill: 'Free for every Sri Lankan school. No limits.',
    title: "Your whole school's week, planned in one place.",
    sub: 'මුළු පාසලේම සතියේ කාලසටහන, එකම තැනකින් පහසුවෙන්.',
    subLang: 'si',
    body: "Auto-fill the week in seconds, then fine-tune class and teacher timetables side by side, with clash prevention, live period counts and every teacher's timetable on their phone.",
    register: 'Register your school',
    teacherLogin: 'Teacher login',
  },
  grid: {
    label: 'Example timetable for Grade 6B',
    title: 'Grade 6B · 2027',
    summary: 'Maths 6/6 · Science 4/5',
    clash: 'Clash: Mr. Perera is with 6A. Offered a free Maths teacher.',
    period: 'P',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    subjects: {
      maths: 'Maths',
      sinhala: 'Sinhala',
      english: 'English',
      science: 'Science',
      religion: 'Religion',
      history: 'History',
      geography: 'Geography',
      aesthetic: 'Aesthetic',
      pe: 'PE',
      health: 'Health',
    },
  },
  features: {
    title: 'Made for how Sri Lankan schools actually work',
    intro: 'Primary class teachers, religion and aesthetic groups, combined classes: all built in, no spreadsheet workarounds.',
    scene: {
      cls: 'Class 6B',
      teacher: 'Ms. Silva',
      busy: 'Mr. Perera',
      period: 'P3',
      maths: 'Maths',
      combo: '6A + 6B · P4',
      aesthetic: 'Aesthetic',
      options: ['Art', 'Music', 'Dance'],
      leave: 'On leave',
      missed: 'P2 · 7A',
      relief: 'Relief',
    },
    items: [
      { title: 'Class + teacher views', body: 'Fill the week from a class grid or a teacher grid. Every change shows in both at once.' },
      { title: 'Clash prevention', body: 'When you fill a period, only teachers who teach that subject and grade and are free at that time are offered. Double-bookings are stopped before they happen.' },
      { title: 'Live period counts', body: 'Set periods per week for each subject and grade, and a daily limit for each teacher. Watch "Maths 4/6" fill up and see what is missing before you publish.' },
      { title: 'Religion, aesthetic & combined classes', body: 'Religion and aesthetic options run in the same period, each with its own teacher, even across 6A and 6B together.' },
      { title: 'Teachers on their phone', body: "Publish the timetable and every teacher sees today's periods and their week on their phone. Printed timetables cover anyone without one." },
      { title: 'Sinhala & English', body: 'Every screen and every printout in Sinhala or English. Each person picks their own.' },
      { title: 'Relief periods', body: "Mark who is on leave each morning, get fair relief suggestions for every missed period, and print the day's relief sheet." },
    ],
  },
  steps: {
    title: 'Up and running in an afternoon',
    step: 'Step',
    items: [
      { title: 'Register your school', body: "Enter your school's census number, then add your logo and colours." },
      { title: 'Add teachers & subjects', body: 'Type them in or upload the Excel template: staff IDs, subjects and the grades each teacher takes.' },
      { title: 'Set up grades & periods', body: 'Classes, class teachers, period times and periods per subject for each grade.' },
      { title: 'Build, publish & print', body: 'Auto-fill the grid or fill it by hand, without clashes. Publish to teachers, and print class and teacher timetables.' },
    ],
  },
  faq: {
    title: 'Questions schools ask',
    items: [
      {
        q: 'Is Sathiya really free?',
        a: 'Yes, completely. There are no fees, no paid plans and no advertising, and no limits on teachers, classes, subjects or years. Sathiya is also open source: anyone can read the code on GitHub.',
      },
      {
        q: 'Can it build the timetable for us?',
        a: 'Yes. Auto-fill generates the timetable from your periods per subject, the subjects and grades each teacher takes, and their daily limits, without clashes. It can keep the lessons you already placed and fill only what is missing. You see the result before anything is saved, then change any period by hand.',
      },
      {
        q: 'Can it handle religion groups, aesthetic subjects and combined classes?',
        a: 'Yes. Religion and aesthetic subjects are set up as groups whose options run in the same period, each with its own teacher, and a group can join classes such as 6A and 6B. Class and teacher timetables stay in step.',
      },
      {
        q: 'How does it prevent clashes?',
        a: "When you fill a period, Sathiya only offers teachers who teach that subject and grade, are free at that time and are under their daily limit. A teacher who is already busy in that period isn't offered.",
      },
      {
        q: 'Is our work saved? Can several people work on it?',
        a: 'Every change is saved as you make it. Your school can have more than one administrator, so the timetable committee can share the work. Teachers see the timetable only after you publish it.',
      },
      {
        q: 'Can we change the timetable during the year?',
        a: 'Yes. Change a lesson or a teacher in one place and the class and teacher views both update. Publish again and teachers see the new version.',
      },
      {
        q: "Who can see our school's data?",
        a: "Only people your school's administrators add. Administrators manage the timetable. Teachers see their own timetable and the school's timetables. The only public details are your school's name, district and whether it is active, so the school can be named on invite links and found when someone reports a school. We do not sell your data.",
      },
      {
        q: 'Do teachers need a smartphone?',
        a: "No. Teachers with a phone can check today's periods and their week any time, with nothing to install. For anyone else, print their timetable. Building the timetable is made for a laptop or desktop, but tablets work too.",
      },
      {
        q: 'Can we use it in Sinhala?',
        a: 'Yes. Every screen and printout is available in Sinhala and English, and each person can choose their own language.',
      },
      {
        q: 'How do teachers log in?',
        a: "Teachers sign in with Google or with an email and password. Your administrator shares the school's invite link, or a personal link made for one teacher. A teacher whose email matches their record is linked at once. Anyone else enters their staff ID and waits for an administrator to approve. Teachers who only need a printed timetable don't need an account.",
      },
    ],
    report: 'Seen a fake or duplicate school registration?',
  },
  cta: {
    title: 'Build your school timetable in days, not weeks.',
    sub: 'සෑම ශ්‍රී ලාංකීය පාසලකටම නොමිලේ.',
    subLang: 'si',
    button: 'Register your school',
  },
  footer: {
    copyright: '© 2026 Sathiya (සතිය)',
    label: 'Legal',
    terms: 'Terms & Conditions',
    privacy: 'Privacy Policy',
    contact: 'Contact',
    guides: 'Guides',
    report: 'Report a school',
    analytics: 'Analytics settings',
  },
  consent: {
    label: 'Analytics consent',
    text: 'May we use Google Analytics to count visits and improve this site? It stays off unless you allow it.',
    allow: 'Allow analytics',
    deny: 'No thanks',
  },
  guide: {
    title: 'Guides',
    intro: 'Short videos and step-by-step guides for school admins and teachers.',
    all: 'All guides',
    video: 'Watch the video',
    videoSoon: 'The video for this guide is coming soon. Follow the steps below.',
    steps: 'Step by step',
    minutes: 'About {n} minutes',
  },
  legal: {
    version: 'Version',
    lastUpdated: 'Last updated',
  },
  terms: {
    title: 'Terms & Conditions',
    sections: [
      {
        title: 'The service',
        body: [
          'Sathiya is a free web service that helps Sri Lankan schools build and share class and teacher timetables. There is no charge to use it.',
        ],
      },
      {
        title: 'Who can use it',
        body: [
          'A school is registered by an administrator who is allowed to act for that school. Administrators can add other administrators and teachers.',
        ],
      },
      {
        title: 'Responsibilities of administrators',
        body: [
          'Administrators are responsible for what they enter, for adding only people who should have access, and for removing access when someone leaves the school.',
          'Everyone must keep their login details private.',
        ],
      },
      {
        title: "Your school's data",
        body: [
          "Your school's data belongs to your school. We store it only to run Sathiya and we do not sell it. The Privacy Policy explains what we collect and where it is kept.",
        ],
      },
      {
        title: 'Acceptable use',
        body: [
          "Do not use Sathiya for anything unlawful, to store information that has nothing to do with timetables, or to try to reach another school's data.",
        ],
      },
      {
        title: 'Fake or duplicate registrations',
        body: [
          'Register only a real school that you are allowed to act for, and only once. Fake or duplicate registrations may be suspended.',
        ],
        report: true,
      },
      {
        title: 'No guarantees',
        body: [
          'We work to keep Sathiya running, but it is provided as it is, without any guarantee that it will always be available or free of mistakes. Keep your own printed or exported copy of important timetables.',
        ],
      },
      {
        title: 'Changes',
        body: ['We may update these terms. When we do, the version date on this page will change.'],
      },
      {
        title: 'Contact',
        body: [`Questions about these terms: ${CONTACT_EMAIL}`],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        title: 'What we collect',
        body: [
          'School details: name in English and Sinhala, district, grades offered, staff ID prefix, logo and colours.',
          'Accounts (administrators and teachers who sign in): email address, your name as shown on your Google account if you sign in with Google, and the schools you belong to and your role in each. For administrators we also record which version of the Terms & Conditions and Privacy Policy was accepted, and when.',
          'Teachers: name, staff ID, subjects, grades, and for teachers who link an account, the time they last logged in. Phone numbers and email addresses are kept only if your school chooses to add them.',
          "Join requests: when someone asks to join a school with its invite link, their email address, name and the staff ID they entered. The request and the administrator's decision are kept.",
          'Timetables: subjects, grades, classes, period times and timetable entries. Firebase Authentication also keeps the records it needs to let people sign in.',
          'We do not collect National Identity Card (NIC) numbers. Please do not enter them anywhere in Sathiya.',
        ],
      },
      {
        title: 'Where it is stored',
        body: [
          'Data is stored in Google Firebase, a Google Cloud service. The storage region is the one set for the Sathiya project in the Firebase console.',
        ],
      },
      {
        title: 'Who can see it',
        body: [
          "Your school's administrators can see and change your school's data. Teachers can see timetables in their school.",
          "Your school's name (in English and Sinhala), district and whether it is active are listed publicly, so the school can be named on invite links and found when someone reports a school. Nothing else about your school is shown to other schools or the public.",
        ],
      },
      {
        title: 'How we use it',
        body: [
          'Only to run Sathiya: to show timetables, check for clashes and let people log in. We do not sell data and do not use it for advertising.',
        ],
      },
      {
        title: 'Responsibilities of administrators',
        body: [
          "Administrators decide what is entered about staff, and should tell their staff that their names, staff IDs and, if added, email addresses are used in Sathiya, including to link a teacher's account to their record.",
        ],
      },
      {
        title: 'Website analytics and fonts',
        body: [
          `This website (${SITE_HOST}) uses Google Analytics only after you click "Allow analytics". You can change your choice at any time with "Analytics settings" at the bottom of every page.`,
          "The website's fonts are loaded from Google Fonts, so your browser contacts Google's servers on every visit, whatever your analytics choice.",
        ],
      },
      {
        title: 'Deleting data',
        body: [`An administrator can ask us to delete the school's data by writing to ${CONTACT_EMAIL}.`],
      },
      {
        title: 'Contact',
        body: [`Questions about privacy: ${CONTACT_EMAIL}`],
      },
    ],
  },
  contact: {
    title: 'Contact',
    body: [
      'Sathiya is run as a free contribution to Sri Lankan schools. For questions, feedback or data requests, email us at:',
    ],
    email: CONTACT_EMAIL,
    teacherNote:
      "Are you a teacher? Please ask your school's Sathiya administrator first — they can send you an invite link and update your timetable.",
  },
};

export type Content = typeof en;
