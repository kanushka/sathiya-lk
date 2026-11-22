// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { CONTACT_EMAIL, SITE_HOST } from '../site';

export const en = {
  brand: 'Sathiya',
  skip: 'Skip to content',
  meta: {
    index: {
      title: 'Sathiya — free school timetables for Sri Lankan schools',
      description:
        'Build class and teacher timetables side by side, catch clashes early, and give every teacher their timetable on their phone. Free for every Sri Lankan school, in Sinhala and English.',
    },
    terms: {
      title: 'Terms & Conditions — Sathiya',
      description: 'The terms for using Sathiya, the free school timetable service for Sri Lankan schools.',
    },
    privacy: {
      title: 'Privacy Policy — Sathiya',
      description: 'What Sathiya collects, where it is stored, and who can see it.',
    },
    contact: {
      title: 'Contact — Sathiya',
      description: 'How to reach the people who run Sathiya.',
    },
    '404': {
      title: 'Page not found — Sathiya',
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
    login: 'Log in',
    register: 'Register school',
    menu: 'Menu',
    language: 'Language',
    sinhala: 'සිංහල',
    english: 'English',
  },
  hero: {
    pill: 'Free for every Sri Lankan school',
    title: "Your whole school's week, planned in one place.",
    sub: 'ඔබේ පාසලේ කාලසටහන, පහසුවෙන්.',
    subLang: 'si',
    body: 'Build class and teacher timetables side by side. Sathiya warns you about clashes, counts periods per subject, and gives every teacher their timetable on their phone.',
    register: 'Register your school',
    teacherLogin: 'Teacher login',
  },
  grid: {
    label: 'Example timetable for Grade 6B',
    title: 'Grade 6B · 2027',
    summary: 'Maths 6/6 · Science 4/5',
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
    intro: 'Primary class teachers, religion groups, aesthetic subjects, combined classes — all built in.',
    items: [
      { title: 'Class + teacher views', body: 'Fill the week from a class grid or a teacher grid. Every change shows in both instantly.' },
      { title: 'Clash warnings', body: 'Only teachers who teach that subject, that grade, and are free in that slot appear in the list.' },
      { title: 'Period targets', body: 'Set periods per week per subject for each grade and watch "Maths 4/6" fill up.' },
      { title: 'Groups & combined classes', body: 'Religion and Aesthetic groups run in parallel, even across 6A and 6B together.' },
      { title: 'Teachers on their phone', body: 'Teachers log in with staff ID and see what they teach now and next.' },
      { title: 'Sinhala & English', body: 'Every screen and every printout in the language you prefer.' },
    ],
  },
  steps: {
    title: 'Up and running in an afternoon',
    step: 'Step',
    items: [
      { title: 'Register your school', body: 'Add your name, logo and school colours.' },
      { title: 'Add teachers & subjects', body: 'Staff IDs, subjects, grades they teach.' },
      { title: 'Set up grades', body: 'Classes, class teachers, periods per subject.' },
      { title: 'Build & share', body: 'Fill the grid, print, hand out teacher login slips.' },
    ],
  },
  faq: {
    title: 'Questions schools ask',
    items: [
      {
        q: 'Is Sathiya really free?',
        a: 'Yes. Sathiya is a free service for Sri Lankan schools. There are no fees, no paid plans and no advertising.',
      },
      {
        q: "Who can see our school's data?",
        a: "Only people your school's administrators add. Administrators manage the timetable; teachers see their own timetable and the school's timetables. The only public details are your school's name, district and whether it is active, so teachers can find the school when they log in. We do not sell your data.",
      },
      {
        q: 'Does it work on phones?',
        a: 'Teachers can check their timetable and today\'s periods on any phone. Building the timetable and other admin work is made for a laptop or desktop, and tablets work too. Sathiya runs in a modern browser, so there is nothing to install.',
      },
      {
        q: 'Can we use it in Sinhala?',
        a: 'Yes. Every screen and printout is available in Sinhala and English, and each person can choose their own language.',
      },
      {
        q: 'How do teachers log in?',
        a: 'Your administrator adds each teacher and hands them a login slip. Teachers tap "Teacher login", pick the school, and enter their staff ID and password from the slip.',
      },
    ],
    report: 'Seen a fake or duplicate school registration?',
  },
  cta: {
    title: 'A contribution to the Sri Lankan school community.',
    sub: 'ශ්‍රී ලාංකීය පාසල් සඳහා නොමිලේ.',
    subLang: 'si',
    button: 'Register your school — free',
  },
  footer: {
    copyright: '© 2026 Sathiya',
    label: 'Legal',
    terms: 'Terms & Conditions',
    privacy: 'Privacy Policy',
    contact: 'Contact',
    report: 'Report a school',
    analytics: 'Analytics settings',
  },
  consent: {
    label: 'Analytics consent',
    text: 'May we use Google Analytics to count visits and improve this site? It stays off unless you allow it.',
    allow: 'Allow analytics',
    deny: 'No thanks',
  },
  legal: {
    draft:
      "Draft — this text is waiting for the Sathiya owner's legal review and may change before it is final.",
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
          'Administrator accounts: email address, and your name as shown on your Google account if you sign in with Google. We also record which version of the Terms & Conditions and Privacy Policy was accepted, and when.',
          'Teachers: name, staff ID, subjects, grades and the time they last logged in; phone numbers and email addresses only if your school chooses to add them.',
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
          "Your school's name (in English and Sinhala), district and whether it is active are listed publicly, so teachers can find the school on the login screen. Nothing else about your school is shown to other schools or the public.",
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
          'Administrators decide what is entered about staff, and should tell their staff that their names and staff IDs are used in Sathiya.',
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
      "Are you a teacher? Please ask your school's Sathiya administrator first — they can reset your password and update your timetable.",
  },
};

export type Content = typeof en;
