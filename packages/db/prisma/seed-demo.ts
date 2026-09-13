// Must be first: loads the repository-root .env before anything reads it.
import "@bass/db/env-load";

import {
  AnnouncementPlacement,
  ApplicationStatus,
  ContentStatus,
  EnquiryStatus,
  Gender,
  BoardingPreference,
  StudyLevel,
} from "@bass/db/enums";
import { generateToken, hashToken } from "@bass/auth/crypto";
import { createPrismaClient } from "@bass/db/client";

const db = createPrismaClient();

/**
 * DEMONSTRATION DATA — NOT REAL SCHOOL INFORMATION.
 *
 * Kept in its own file, behind its own command, and fully reversible:
 *
 *   npm run db:seed:demo            apply
 *   npm run db:seed:demo -- --purge remove everything it created
 *
 * Nothing here is a fact about Bugema Adventist Secondary School. It exists so
 * the site can be shown working with content in it. Every address is
 * @bass.example.com (a reserved example domain that can never be a real
 * mailbox) and every telephone number uses an obvious 000-000 placeholder
 * block, so a screenshot can never be mistaken for genuine contact details.
 *
 * Staff names, statistics, examination figures and policy text are invented.
 * They must all be replaced before this site is published.
 */

// Everything below is addressed by a fixed key or slug, which is what lets
// --purge remove exactly what was added and nothing else.
const DEMO_NEWS_SLUGS = [
  "senior-four-candidates-begin-uce-briefings",
  "science-week-brings-laboratories-to-life",
  "new-dormitory-block-opens-for-boarders",
  "students-lead-week-of-spiritual-emphasis",
  "inter-house-athletics-championship-results",
  "bass-debate-team-reaches-regional-final",
];

const DEMO_EVENT_SLUGS = [
  "open-day-for-prospective-parents",
  "beginning-of-term-two",
  "parents-visitation-day",
  "week-of-spiritual-emphasis",
  "inter-house-sports-gala",
];

const DEMO_PROGRAM_SLUGS = ["lower-secondary", "upper-secondary", "co-curricular"];

const DEMO_DEPARTMENT_SLUGS = [
  "sciences",
  "mathematics",
  "languages",
  "humanities",
  "computing-and-business",
];

const DEMO_SUBJECT_SLUGS = [
  "english-language", "mathematics", "physics", "chemistry", "biology",
  "geography", "history", "religious-education", "entrepreneurship",
  "computer-studies", "agriculture", "literature-in-english", "kiswahili",
  "economics", "fine-art",
];

const DEMO_PAGE_SLUGS = [
  "about", "about/history", "about/mission-vision", "about/values",
  "about/facilities", "academics", "academics/curriculum",
  "academics/co-curricular", "admissions", "admissions/how-to-apply",
  "admissions/requirements", "student-life", "contact",
  "policies/privacy", "policies/terms", "policies/admissions",
  "policies/safeguarding", "about/leadership",
];

const DEMO_SETTINGS: Record<string, string> = {
  "school.motto": "Physical, Mental and Spiritual Development",
  "school.tagline": "Educating the whole person since our founding",
  "contact.email": "info@bass.example.com",
  "contact.phone": "+256 700 000 001",
  "contact.altPhone": "+256 700 000 002",
  "contact.postalAddress": "P.O. Box 0000, Kampala",
  "contact.physicalAddress": "Bugema Adventist Secondary School\nBugema, Luweero District\nUganda",
  "contact.officeHours": "Monday to Friday, 8:00am – 5:00pm\nSaturday closed\nSunday 9:00am – 1:00pm",
  "contact.mapEmbedUrl": "",
  "social.facebook": "https://facebook.com/example",
  "social.instagram": "https://instagram.com/example",
  "social.x": "https://x.com/example",
  "social.youtube": "https://youtube.com/@example",
  "social.linkedin": "",
  "seo.defaultDescription":
    "Bugema Adventist Secondary School offers O-level and A-level education in a supportive Christian boarding and day environment, with strong academics, sport and character development.",
  "footer.description":
    "A co-educational Seventh-day Adventist secondary school offering O-level and A-level education to boarding and day students.",
  "admissions.introduction":
    "We welcome applications from students joining Senior One through to Senior Five. Applications are made online and can be saved and resumed at any time.",
  "admissions.email": "admissions@bass.example.com",
  "admissions.phone": "+256 700 000 003",
  "admissions.prospectusUrl": "",
  "admissions.isOpen": "true",
};

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date;
}

// ---------------------------------------------------------------------------

async function mediaByKey() {
  const assets = await db.mediaAsset.findMany({
    where: { folder: { not: "brand" } },
    select: { id: true, storageKey: true },
  });

  const map = new Map<string, string>();
  for (const asset of assets) {
    const slug = asset.storageKey.replace(/^seed\//, "").replace(/\.webp$/, "");
    map.set(slug, asset.id);
  }
  return map;
}

async function applyDemo() {
  const media = await mediaByKey();
  const pick = (slug: string) => media.get(slug) ?? null;

  // --- Settings ----------------------------------------------------------
  for (const [key, value] of Object.entries(DEMO_SETTINGS)) {
    await db.siteSetting.updateMany({
      where: { key },
      data: { value, isConfigured: value !== "" },
    });
  }
  console.log(`  · ${Object.keys(DEMO_SETTINGS).length} settings filled in`);

  // --- Academic year now accepting applications --------------------------
  await db.academicYear.updateMany({
    where: { isActive: true },
    data: {
      isAcceptingApplications: true,
      applicationOpensAt: daysFromNow(-30),
      applicationClosesAt: daysFromNow(90),
    },
  });

  // --- Programmes --------------------------------------------------------
  const programs = [
    {
      slug: "lower-secondary",
      title: "Lower Secondary (S1–S4)",
      level: StudyLevel.O_LEVEL,
      summary: "A broad four-year foundation leading to the Uganda Certificate of Education.",
      body: "<p>Students in Senior One to Senior Four follow the national lower secondary curriculum, studying a broad range of subjects before specialising at A-level.</p><h3>What students study</h3><ul><li>English, Mathematics and the sciences as core subjects</li><li>Humanities including Geography, History and Religious Education</li><li>Practical subjects such as Agriculture, Computer Studies and Fine Art</li></ul><p>All students sit the Uganda Certificate of Education at the end of Senior Four.</p>",
      imageId: pick("classroom"),
      order: 10,
    },
    {
      slug: "upper-secondary",
      title: "Upper Secondary (S5–S6)",
      level: StudyLevel.A_LEVEL,
      summary: "Two years of specialised study leading to the Uganda Advanced Certificate of Education.",
      body: "<p>Senior Five and Senior Six students specialise in three principal subjects alongside subsidiary papers, preparing for university entry.</p><h3>Available combinations</h3><ul><li>Physics, Chemistry and Mathematics</li><li>Biology, Chemistry and Mathematics</li><li>History, Economics and Geography</li><li>Literature, Divinity and History</li></ul>",
      imageId: pick("students-studying"),
      order: 20,
    },
    {
      slug: "co-curricular",
      title: "Co-curricular & Sport",
      level: StudyLevel.BOTH,
      summary: "Sport, music, debate, clubs and community service alongside academic study.",
      body: "<p>Every student takes part in activities beyond the classroom, from competitive sport to music, debate and service in the surrounding community.</p><h3>What is on offer</h3><ul><li>Football, netball, volleyball and athletics</li><li>Choir and instrumental music</li><li>Debating and public speaking</li><li>Scripture union and community outreach</li></ul>",
      imageId: pick("students-on-campus"),
      order: 30,
    },
  ];

  for (const program of programs) {
    await db.academicProgram.upsert({
      where: { slug: program.slug },
      update: {},
      create: { ...program, status: ContentStatus.PUBLISHED },
    });
  }
  console.log(`  · ${programs.length} programmes`);

  // --- Departments -------------------------------------------------------
  const departments = [
    { slug: "sciences", name: "Sciences", description: "Biology, Chemistry and Physics, taught with regular laboratory practicals.", imageId: pick("science-practical"), order: 10 },
    { slug: "mathematics", name: "Mathematics", description: "Mathematics at O-level and A-level, including subsidiary mathematics.", imageId: pick("students-studying"), order: 20 },
    { slug: "languages", name: "Languages", description: "English Language, Literature in English and Kiswahili.", imageId: pick("classroom"), order: 30 },
    { slug: "humanities", name: "Humanities", description: "Geography, History, Economics and Religious Education.", imageId: null, order: 40 },
    { slug: "computing-and-business", name: "Computing & Business", description: "Computer Studies, Entrepreneurship and Commerce.", imageId: null, order: 50 },
  ];

  const departmentIds = new Map<string, string>();
  for (const department of departments) {
    const row = await db.academicDepartment.upsert({
      where: { slug: department.slug },
      update: {},
      create: {
        ...department,
        body: `<p>The ${department.name} department teaches across both O-level and A-level, with subject teachers supporting students through coursework, practicals and examination preparation.</p>`,
        status: ContentStatus.PUBLISHED,
      },
      select: { id: true },
    });
    departmentIds.set(department.slug, row.id);
  }
  console.log(`  · ${departments.length} departments`);

  // --- Subjects ----------------------------------------------------------
  const subjects: [string, string, string, StudyLevel, boolean][] = [
    ["english-language", "English Language", "languages", StudyLevel.BOTH, true],
    ["mathematics", "Mathematics", "mathematics", StudyLevel.BOTH, true],
    ["physics", "Physics", "sciences", StudyLevel.BOTH, false],
    ["chemistry", "Chemistry", "sciences", StudyLevel.BOTH, false],
    ["biology", "Biology", "sciences", StudyLevel.BOTH, false],
    ["geography", "Geography", "humanities", StudyLevel.BOTH, false],
    ["history", "History", "humanities", StudyLevel.BOTH, false],
    ["religious-education", "Religious Education", "humanities", StudyLevel.BOTH, true],
    ["entrepreneurship", "Entrepreneurship", "computing-and-business", StudyLevel.BOTH, false],
    ["computer-studies", "Computer Studies", "computing-and-business", StudyLevel.BOTH, false],
    ["agriculture", "Agriculture", "sciences", StudyLevel.O_LEVEL, false],
    ["literature-in-english", "Literature in English", "languages", StudyLevel.BOTH, false],
    ["kiswahili", "Kiswahili", "languages", StudyLevel.O_LEVEL, false],
    ["economics", "Economics", "humanities", StudyLevel.A_LEVEL, false],
    ["fine-art", "Fine Art", "languages", StudyLevel.O_LEVEL, false],
  ];

  for (const [slug, name, departmentSlug, level, isCore] of subjects) {
    await db.subject.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name,
        level,
        isCore,
        departmentId: departmentIds.get(departmentSlug) ?? null,
        description: `${name} is taught throughout the ${level === StudyLevel.A_LEVEL ? "upper" : "lower"} secondary programme.`,
        status: ContentStatus.PUBLISHED,
        order: subjects.findIndex((entry) => entry[0] === slug) * 10,
      },
    });
  }
  console.log(`  · ${subjects.length} subjects`);

  // --- Staff (INVENTED PEOPLE) -------------------------------------------
  const staff = [
    ["Samuel Kaggwa", "Head Teacher", true],
    ["Grace Namutebi", "Deputy Head Teacher — Academics", true],
    ["Daniel Okello", "Deputy Head Teacher — Boarding", true],
    ["Esther Nabirye", "Director of Studies", true],
    ["Joseph Ssemakula", "School Chaplain", true],
    ["Ruth Akello", "Head of Sciences", false],
    ["Peter Mugisha", "Head of Mathematics", false],
    ["Sarah Nakimuli", "Bursar", false],
  ] as const;

  for (const [index, [name, position, isLeadership]] of staff.entries()) {
    const existing = await db.staffProfile.findFirst({ where: { name }, select: { id: true } });
    if (existing) continue;

    await db.staffProfile.create({
      data: {
        name,
        position,
        isLeadership,
        isVisible: true,
        order: index * 10,
        bio: isLeadership
          ? `${name} leads on ${position.toLowerCase().replace(/^.*— /, "")} and works with staff, students and parents to support the life of the school.`
          : null,
      },
    });
  }
  console.log(`  · ${staff.length} staff profiles (invented people)`);

  // --- Admission requirements --------------------------------------------
  const requirements = [
    ["Completed Primary Leaving Examinations", "Applicants to Senior One must have sat the Primary Leaving Examinations and present their results slip.", StudyLevel.O_LEVEL],
    ["Uganda Certificate of Education", "Applicants to Senior Five must present their UCE results, meeting the minimum requirement for their chosen combination.", StudyLevel.A_LEVEL],
    ["School report from the previous year", "A report from the applicant's most recent school, showing academic performance and conduct.", StudyLevel.BOTH],
    ["Interview and entrance assessment", "Shortlisted applicants are invited for a short entrance assessment and an interview with a member of staff.", StudyLevel.BOTH],
    ["Commitment to the school's values", "Students and parents are asked to read and accept the school rules and code of conduct before enrolment.", StudyLevel.BOTH],
  ] as const;

  for (const [index, [title, description, level]] of requirements.entries()) {
    const existing = await db.admissionRequirement.findFirst({ where: { title }, select: { id: true } });
    if (existing) continue;

    await db.admissionRequirement.create({
      data: { title, description, level, order: index * 10, status: ContentStatus.PUBLISHED },
    });
  }
  console.log(`  · ${requirements.length} admission requirements`);

  // --- News --------------------------------------------------------------
  const news: [string, string, string, string, string | null, number][] = [
    ["senior-four-candidates-begin-uce-briefings", "Senior Four candidates begin UCE briefings", "Candidates and their teachers met this week to go through the examination timetable and revision plan.", "Academics", pick("students-studying"), -3],
    ["science-week-brings-laboratories-to-life", "Science week brings the laboratories to life", "Students spent the week on practical work across biology, chemistry and physics.", "Academics", pick("science-practical"), -10],
    ["new-dormitory-block-opens-for-boarders", "New dormitory block opens for boarders", "Additional accommodation has come into use at the start of this term.", "School life", pick("boarding-house"), -18],
    ["students-lead-week-of-spiritual-emphasis", "Students lead the week of spiritual emphasis", "Student leaders led morning and evening worship throughout the week.", "Spiritual life", pick("students-on-campus"), -25],
    ["inter-house-athletics-championship-results", "Inter-house athletics championship results", "Houses competed across track and field events on the school grounds.", "Sport", pick("campus-pathway"), -34],
    ["bass-debate-team-reaches-regional-final", "Debate team reaches the regional final", "The team argued on access to secondary education and progressed to the final round.", "Achievements", pick("classroom"), -45],
  ];

  for (const [slug, title, excerpt, category, imageId, offset] of news) {
    await db.newsArticle.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title,
        excerpt,
        category,
        featuredImageId: imageId,
        isFeatured: offset > -12,
        status: ContentStatus.PUBLISHED,
        publishedAt: daysFromNow(offset),
        body: `<p>${excerpt}</p><p>Staff and students took part throughout the week. Further details are available from the school office.</p><h3>What happened</h3><ul><li>Students from every year group took part</li><li>Staff supervised activities across the campus</li><li>Parents are welcome to contact the school for more information</li></ul>`,
      },
    });
  }
  console.log(`  · ${news.length} news articles`);

  // --- Events ------------------------------------------------------------
  const events: [string, string, string, number, string, string, string | null][] = [
    ["open-day-for-prospective-parents", "Open day for prospective parents", "A guided visit of the campus with the opportunity to meet staff and current students.", 14, "9:00am", "Main campus", pick("campus-pathway")],
    ["beginning-of-term-two", "Beginning of Term Two", "Boarders report to their houses; day students begin lessons the following morning.", 30, "8:00am", "Main campus", pick("boarding-house")],
    ["parents-visitation-day", "Parents' visitation day", "Parents and guardians are invited to visit boarders and meet subject teachers.", 45, "10:00am", "School grounds", pick("students-on-campus")],
    ["week-of-spiritual-emphasis", "Week of spiritual emphasis", "A week of morning and evening worship led by students and invited speakers.", 60, "7:00am", "School chapel", pick("classroom")],
    ["inter-house-sports-gala", "Inter-house sports gala", "Houses compete across athletics, football, netball and volleyball.", 75, "8:30am", "Sports field", pick("student-portrait")],
  ];

  for (const [slug, title, description, offset, startTime, location, imageId] of events) {
    await db.event.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title,
        description,
        location,
        startTime,
        endTime: "4:00pm",
        imageId,
        startDate: daysFromNow(offset),
        status: ContentStatus.PUBLISHED,
        isFeatured: offset < 20,
        body: `<p>${description}</p><p>Please contact the school office if you need directions or have any questions before the day.</p>`,
      },
    });
  }
  console.log(`  · ${events.length} events`);

  // --- Page bodies -------------------------------------------------------
  const pageBodies: Record<string, string> = {
    about: "<p>Bugema Adventist Secondary School is a co-educational Seventh-day Adventist secondary school offering O-level and A-level education to both boarding and day students.</p><p>The school combines academic teaching with sport, service and spiritual life, aiming to develop students physically, mentally and spiritually.</p>",
    "about/history": "<p>The school was founded to provide secondary education within the Adventist tradition, and has grown steadily since, adding classrooms, laboratories and boarding accommodation.</p><p>Today it serves students from across the region at both O-level and A-level.</p>",
    "about/mission-vision": "<h3>Our mission</h3><p>To provide quality secondary education that develops students physically, mentally and spiritually, preparing them for service and for further study.</p><h3>Our vision</h3><p>To be a school known for academic strength, personal integrity and care for every student.</p>",
    "about/values": "<ul><li><strong>Integrity</strong> — honesty in work and in conduct.</li><li><strong>Service</strong> — using ability for the benefit of others.</li><li><strong>Discipline</strong> — steady habits of study and behaviour.</li><li><strong>Respect</strong> — for staff, for one another, and for the school.</li><li><strong>Faith</strong> — a spiritual life expressed in daily practice.</li></ul>",
    "about/facilities": "<p>The campus includes classroom blocks, science laboratories, a computer room, a library, boarding houses, a dining hall and sports grounds.</p><h3>Boarding</h3><p>Separate boarding houses accommodate girls and boys, supervised by resident staff.</p><h3>Catering</h3><p>Meals are prepared on site in the school kitchen and served in the dining hall.</p>",
    academics: "<p>Teaching follows the Uganda national curriculum at both O-level and A-level, organised into subject departments.</p>",
    "academics/curriculum": "<p>Students in Senior One to Senior Four follow the lower secondary curriculum and sit the Uganda Certificate of Education. Senior Five and Senior Six students specialise in three principal subjects leading to the Uganda Advanced Certificate of Education.</p>",
    "academics/co-curricular": "<p>Students take part in sport, music, debate, clubs and community service alongside their studies.</p><ul><li>Football, netball, volleyball and athletics</li><li>Choir and instrumental music</li><li>Debating and public speaking</li><li>Scripture union and community outreach</li></ul>",
    admissions: "<p>We welcome applications throughout the year for entry at Senior One and Senior Five, and for transfers into other year groups where places are available.</p>",
    "admissions/how-to-apply": "<h3>How to apply</h3><ol><li>Read the entry requirements for the year group you are applying to.</li><li>Complete the online application form. You can save it and return to it later.</li><li>Upload any supporting documents you have available.</li><li>Submit the application and keep the reference number you are given.</li><li>The admissions office will contact you about the next steps.</li></ol>",
    "admissions/requirements": "<p>Requirements vary by year group. The list below sets out what applicants are normally asked to provide.</p>",
    "student-life": "<p>Life at the school extends well beyond lessons — into worship, sport, clubs, leadership and service.</p><h3>Boarding life</h3><p>Boarders live in supervised houses with structured study, worship and recreation.</p><h3>Leadership</h3><p>Prefects and club leaders take real responsibility for the daily running of school life.</p>",
    contact: "<p>The school office is glad to answer questions about admissions, fees, visits and any other matter.</p>",
    "policies/privacy": "<p><strong>This is placeholder text and is not a legal document.</strong> The school must supply its own privacy notice before this site is published.</p><p>It should explain what personal data the school collects through this website, why it is collected, how long it is kept, who it is shared with, and how to request access or deletion.</p>",
    "policies/terms": "<p><strong>This is placeholder text and is not a legal document.</strong> The school must supply its own terms of use before this site is published.</p>",
    "policies/admissions": "<p><strong>This is placeholder text and is not the school's admissions policy.</strong> The official policy must be supplied by the school before this site is published.</p>",
    "policies/safeguarding": "<p><strong>This is placeholder text and is not the school's safeguarding policy.</strong> The official policy, together with the name and contact details of the designated safeguarding lead, must be supplied by the school before this site is published.</p>",
    "about/leadership": "<p>The school is led by a senior team responsible for academics, boarding, pastoral care and administration.</p>",
  };

  for (const [slug, body] of Object.entries(pageBodies)) {
    await db.page.updateMany({ where: { slug }, data: { body } });
  }
  console.log(`  · ${Object.keys(pageBodies).length} page bodies written`);

  // --- Homepage content ---------------------------------------------------
  //
  // The layout is fixed in code; these are the rows that fill it.
  const features = [
    ["Academic excellence", "Teaching follows the national curriculum with regular assessment and examination preparation at both levels.", pick("classroom")],
    ["Character development", "Clear expectations of conduct, supported by house staff and a pastoral team who know students well.", pick("students-on-campus")],
    ["Christian education", "Daily worship and a weekly programme of spiritual life run through the ordinary rhythm of the school.", pick("campus-pathway")],
    ["Student support", "Subject teachers, house staff and the chaplaincy work together to support students academically and personally.", pick("students-studying")],
  ] as const;

  for (const [index, [title, body, mediaId]] of features.entries()) {
    const existing = await db.homeFeature.findFirst({ where: { title }, select: { id: true } });
    if (existing) continue;
    await db.homeFeature.create({
      data: { title, body, mediaId, order: index * 10 },
    });
  }
  console.log(`  \u00b7 ${features.length} homepage feature cards`);

  const highlights = [
    ["15", "subjects across five departments", "From English and the sciences to Fine Art.", pick("laboratory-specimen")],
    ["4", "A-level combinations to choose from", "Sciences, humanities and languages.", pick("students-studying")],
    ["2", "boarding houses with resident staff", "Separate houses for girls and boys.", pick("boarding-house")],
    ["3", "meals prepared on site every day", "Cooked in the school kitchen.", pick("school-kitchen")],
  ] as const;

  for (const [index, [value, label, caption, mediaId]] of highlights.entries()) {
    const existing = await db.homeHighlight.findFirst({ where: { label }, select: { id: true } });
    if (existing) continue;
    await db.homeHighlight.create({
      data: { value, label, caption, mediaId, order: index * 10 },
    });
  }
  console.log(`  \u00b7 ${highlights.length} homepage highlights`);

  // --- Announcement ------------------------------------------------------
  const existingAnnouncement = await db.announcement.findFirst({
    where: { title: "Applications are now open" },
    select: { id: true },
  });
  if (!existingAnnouncement) {
    await db.announcement.create({
      data: {
        title: "Applications are now open",
        body: "Apply online for Senior One and Senior Five.",
        linkLabel: "Apply now",
        linkHref: "/admissions/apply",
        placement: AnnouncementPlacement.GLOBAL,
        priority: 10,
        isActive: true,
        startsAt: daysFromNow(-7),
        endsAt: daysFromNow(60),
      },
    });
    console.log("  · 1 announcement");
  }

  // --- Gallery album gets a second album ---------------------------------
  const albumImages = await db.mediaAsset.findMany({
    where: { folder: { in: ["academics", "facilities"] } },
    select: { id: true },
  });
  if (albumImages.length > 0) {
    const album = await db.galleryAlbum.upsert({
      where: { slug: "academics-and-facilities" },
      update: {},
      create: {
        slug: "academics-and-facilities",
        title: "Academics & facilities",
        description: "Laboratories, classrooms and the wider campus.",
        coverImageId: albumImages[0].id,
        status: ContentStatus.PUBLISHED,
        order: 20,
      },
      select: { id: true },
    });

    for (const [index, image] of albumImages.entries()) {
      await db.galleryImage.upsert({
        where: { albumId_mediaId: { albumId: album.id, mediaId: image.id } },
        update: {},
        create: { albumId: album.id, mediaId: image.id, order: index * 10 },
      });
    }
    console.log("  · 1 extra gallery album");
  }

  // --- Contact enquiries so the admin inbox is not empty -----------------
  const enquiries = [
    ["Miriam Nansubuga", "miriam@bass.example.com", "Senior One places for 2027", "Good morning. I would like to know whether places are still available for Senior One next year, and what the fees are."],
    ["Robert Ssentongo", "robert@bass.example.com", "Transfer from another school", "My daughter is currently in Senior Two elsewhere and we are considering a transfer. Could you advise on the process?"],
    ["Alice Auma", "alice@bass.example.com", "Boarding facilities", "Please could you tell me more about the boarding houses and how students are supervised?"],
  ] as const;

  for (const [name, email, subject, body] of enquiries) {
    const existing = await db.contactEnquiry.findFirst({ where: { email, subject }, select: { id: true } });
    if (existing) continue;
    await db.contactEnquiry.create({
      data: { name, email, subject, body, status: EnquiryStatus.UNREAD },
    });
  }
  console.log(`  · ${enquiries.length} contact enquiries`);

  // --- Applications, so the admin dashboard has something to manage ------
  const year = await db.academicYear.findFirst({ where: { isActive: true }, select: { id: true, name: true } });
  const classes = await db.applicationClass.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } });

  if (year && classes.length > 0) {
    const applicants: [string, string, string, ApplicationStatus, number][] = [
      ["Aisha", "Nakato", "Senior 1", ApplicationStatus.SUBMITTED, 0],
      ["Brian", "Wasswa", "Senior 1", ApplicationStatus.UNDER_REVIEW, 1],
      ["Catherine", "Achieng", "Senior 5", ApplicationStatus.SHORTLISTED, 4],
      ["David", "Kato", "Senior 1", ApplicationStatus.ACCEPTED, 2],
      ["Esther", "Nabukenya", "Senior 2", ApplicationStatus.DOCUMENTS_REQUIRED, 1],
      ["Francis", "Opio", "Senior 5", ApplicationStatus.REJECTED, 4],
      ["Gloria", "Namusoke", "Senior 1", ApplicationStatus.SUBMITTED, 0],
    ];

    let created = 0;
    for (const [index, [firstName, lastName, className, status, classIndex]] of applicants.entries()) {
      const reference = `BASS-${year.name}-${String(index + 1).padStart(6, "0")}`;
      const existing = await db.application.findUnique({ where: { referenceNumber: reference }, select: { id: true } });
      if (existing) continue;

      const application = await db.application.create({
        data: {
          referenceNumber: reference,
          draftTokenHash: hashToken(generateToken()),
          accessTokenHash: hashToken(generateToken()),
          status,
          academicYearId: year.id,
          applicationClassId: classes[classIndex]?.id ?? classes[0].id,
          boardingPreference: index % 2 === 0 ? BoardingPreference.BOARDING : BoardingPreference.DAY,
          firstName,
          lastName,
          dateOfBirth: new Date(2010 - classIndex, (index * 2) % 12, 12),
          gender: index % 2 === 0 ? Gender.FEMALE : Gender.MALE,
          nationality: "Ugandan",
          homeDistrict: "Luweero",
          guardianName: `${firstName === "Aisha" ? "Hadija" : "Margaret"} ${lastName}`,
          guardianRelationship: "Mother",
          guardianPhone: `+256 700 000 1${String(index).padStart(2, "0")}`,
          guardianEmail: `${firstName.toLowerCase()}.guardian@bass.example.com`,
          previousSchool: "Demo Primary School",
          previousClass: className === "Senior 1" ? "P7" : "S4",
          contactEmail: `${firstName.toLowerCase()}.guardian@bass.example.com`,
          contactPhone: `+256 700 000 1${String(index).padStart(2, "0")}`,
          submittedAt: daysFromNow(-(index + 2)),
        },
        select: { id: true },
      });

      await db.applicationEvent.create({
        data: {
          applicationId: application.id,
          action: "submitted",
          actorType: "APPLICANT",
          newValue: ApplicationStatus.SUBMITTED,
          isVisibleToApplicant: true,
          createdAt: daysFromNow(-(index + 2)),
        },
      });

      if (status !== ApplicationStatus.SUBMITTED) {
        await db.applicationEvent.create({
          data: {
            applicationId: application.id,
            action: "status_changed",
            actorType: "STAFF",
            oldValue: "SUBMITTED",
            newValue: status,
            isVisibleToApplicant: true,
            createdAt: daysFromNow(-(index + 1)),
          },
        });
      }
      created++;
    }
    console.log(`  · ${created} applications with history`);
  }

  const { reindexAll } = await import("@bass/core/search");
  console.log(`  · ${await reindexAll()} documents reindexed`);
}

// ---------------------------------------------------------------------------

async function purgeDemo() {
  await db.applicationEvent.deleteMany({ where: { application: { referenceNumber: { contains: "BASS-" } } } });
  await db.application.deleteMany({ where: { contactEmail: { endsWith: "@bass.example.com" } } });
  await db.contactEnquiry.deleteMany({ where: { email: { endsWith: "@bass.example.com" } } });
  await db.announcement.deleteMany({ where: { title: "Applications are now open" } });
  await db.galleryImage.deleteMany({ where: { album: { slug: "academics-and-facilities" } } });
  await db.galleryAlbum.deleteMany({ where: { slug: "academics-and-facilities" } });
  await db.newsArticle.deleteMany({ where: { slug: { in: DEMO_NEWS_SLUGS } } });
  await db.event.deleteMany({ where: { slug: { in: DEMO_EVENT_SLUGS } } });
  await db.subject.deleteMany({ where: { slug: { in: DEMO_SUBJECT_SLUGS } } });
  await db.academicDepartment.deleteMany({ where: { slug: { in: DEMO_DEPARTMENT_SLUGS } } });
  await db.academicProgram.deleteMany({ where: { slug: { in: DEMO_PROGRAM_SLUGS } } });
  await db.admissionRequirement.deleteMany({});
  await db.staffProfile.deleteMany({});
  await db.page.updateMany({ where: { slug: { in: DEMO_PAGE_SLUGS } }, data: { body: null } });

  await db.homeFeature.deleteMany({});
  await db.homeHighlight.deleteMany({});

  // Settings return to unconfigured placeholders, except the ones the school
  // genuinely supplied (name, short name, logo, copyright, title template).
  for (const key of Object.keys(DEMO_SETTINGS)) {
    if (key === "admissions.isOpen") {
      await db.siteSetting.updateMany({ where: { key }, data: { value: "false", isConfigured: true } });
      continue;
    }
    await db.siteSetting.updateMany({ where: { key }, data: { value: "", isConfigured: false } });
  }

  await db.academicYear.updateMany({ where: { isActive: true }, data: { isAcceptingApplications: false } });

  const { reindexAll } = await import("@bass/core/search");
  await reindexAll();
  console.log("  · demonstration data removed");
}

async function main() {
  const purge = process.argv.includes("--purge");

  if (purge) {
    console.log("\nRemoving demonstration data\n");
    await purgeDemo();
    console.log("\nDone. The site is back to real content only.\n");
    return;
  }

  console.log("\n" + "=".repeat(68));
  console.log("  SEEDING DEMONSTRATION DATA — NOT REAL SCHOOL INFORMATION");
  console.log("=".repeat(68));
  console.log("  Staff names, statistics, policies and results below are invented.");
  console.log("  Emails use @bass.example.com; phone numbers are placeholders.");
  console.log("  Remove with: npm run db:seed:demo -- --purge");
  console.log("=".repeat(68) + "\n");

  await applyDemo();

  console.log("\nDone. Remember to purge before the site goes live.\n");
}

main()
  .catch((error) => {
    console.error("\nDemo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
