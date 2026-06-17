import {
  CampaignStatus,
  PrismaClient,
  UserRole,
  VerificationStatus
} from "@prisma/client";
import bcrypt from "bcrypt";
import { DEFAULT_ABOUT_CONTENT } from "../src/shared/index.js";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password@123";

async function createMember(input: {
  email: string;
  fullName: string;
  city: string;
  bio?: string;
  age: number;
  profession: string;
  education: string;
  sect?: string;
  verified?: boolean;
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {},
    create: {
      email: input.email,
      passwordHash,
      role: UserRole.USER,
      profile: {
        create: {
          fullName: input.fullName,
          city: input.city,
          bio: input.bio ?? `${input.fullName} is a verified member of Dogar Welfare.`,
          verificationStatus: input.verified === false ? VerificationStatus.PENDING : VerificationStatus.VERIFIED
        }
      },
      matrimonial: {
        create: {
          age: input.age,
          sect: input.sect ?? "Sunni",
          profession: input.profession,
          education: input.education,
          maritalStatus: "Never married",
          aboutFamily: "Respected family seeking a compatible match with honesty and transparency."
        }
      }
    },
    include: { profile: true, matrimonial: true }
  });
  return user;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@dogar.org" },
    update: {},
    create: {
      email: "admin@dogar.org",
      passwordHash,
      role: UserRole.ADMIN,
      profile: {
        create: {
          fullName: "Administrator",
          city: "Lahore",
          bio: "Platform administrator account.",
          verificationStatus: VerificationStatus.VERIFIED
        }
      }
    }
  });

  const members = await Promise.all([
    createMember({
      email: "sara.khan@example.com",
      fullName: "Sara Khan",
      city: "Lahore",
      age: 26,
      profession: "Teacher",
      education: "M.Ed"
    }),
    createMember({
      email: "ahmed.ali@example.com",
      fullName: "Ahmed Ali",
      city: "Karachi",
      age: 29,
      profession: "Software Engineer",
      education: "BS Computer Science"
    }),
    createMember({
      email: "fatima.rashid@example.com",
      fullName: "Fatima Rashid",
      city: "Islamabad",
      age: 24,
      profession: "Medical Officer",
      education: "MBBS"
    }),
    createMember({
      email: "usman.malik@example.com",
      fullName: "Usman Malik",
      city: "Faisalabad",
      age: 31,
      profession: "Business Owner",
      education: "MBA"
    })
  ]);

  for (let i = 0; i < members.length; i++) {
    for (let j = 0; j < members.length; j++) {
      if (i === j) continue;
      const source = members[i].matrimonial;
      const target = members[j];
      if (!source) continue;
      await prisma.matchRecommendation.create({
        data: {
          matrimonialProfileId: source.id,
          recommendedUserId: target.id,
          score: 72 + ((i + j) % 20),
          rationale: "Compatible age, city preference, and education background."
        }
      });
    }
  }

  const campaigns = await Promise.all([
    prisma.campaign.upsert({
      where: { id: "seed-campaign-families" },
      update: {},
      create: {
        id: "seed-campaign-families",
        title: "Winter Family Relief",
        description: "Support verified families with food, fuel, and essential supplies this winter.",
        goalAmount: 500_000,
        raisedAmount: 185_000,
        status: CampaignStatus.ACTIVE,
        isVerified: true
      }
    }),
    prisma.campaign.upsert({
      where: { id: "seed-campaign-education" },
      update: {},
      create: {
        id: "seed-campaign-education",
        title: "Education Support Fund",
        description: "Help students from underserved communities continue their studies.",
        goalAmount: 300_000,
        raisedAmount: 92_500,
        status: CampaignStatus.ACTIVE,
        isVerified: true
      }
    })
  ]);

  await prisma.donation.createMany({
    data: [
      { userId: members[0].id, campaignId: campaigns[0].id, amount: 25_000, message: "Sadaqah" },
      { userId: members[1].id, campaignId: campaigns[0].id, amount: 15_000, message: "General Charity" },
      { userId: members[2].id, campaignId: campaigns[1].id, amount: 10_000, message: "Zakat" }
    ],
    skipDuplicates: true
  });

  const postAuthors = [members[0], members[1], admin];
  const posts = await Promise.all([
    prisma.communityPost.upsert({
      where: { id: "seed-post-welcome" },
      update: {},
      create: {
        id: "seed-post-welcome",
        authorId: postAuthors[0].id,
        content: "Assalamualaikum everyone! Grateful to be part of this trusted community. Looking forward to connecting with families."
      }
    }),
    prisma.communityPost.upsert({
      where: { id: "seed-post-campaign" },
      update: {},
      create: {
        id: "seed-post-campaign",
        authorId: postAuthors[1].id,
        content: "The Winter Family Relief campaign is live. Every contribution is tracked transparently — please share with your network."
      }
    }),
    prisma.communityPost.upsert({
      where: { id: "seed-post-moderation" },
      update: {},
      create: {
        id: "seed-post-moderation",
        authorId: postAuthors[2].id,
        content: "Reminder: profiles and posts are moderated for safety. Report anything suspicious to the admin team."
      }
    })
  ]);

  await prisma.postComment.createMany({
    data: [
      { postId: posts[0].id, authorName: "Ahmed Ali", content: "Welcome Sara! Great to have you here." },
      { postId: posts[1].id, authorName: "Fatima Rashid", content: "Shared with my family group." }
    ],
    skipDuplicates: true
  });

  await prisma.postLike.createMany({
    data: [
      { postId: posts[0].id, userId: members[1].id },
      { postId: posts[0].id, userId: members[2].id },
      { postId: posts[1].id, userId: members[0].id }
    ],
    skipDuplicates: true
  });

  await prisma.siteAbout.upsert({
    where: { id: "default" },
    update: { content: DEFAULT_ABOUT_CONTENT as object },
    create: {
      id: "default",
      content: DEFAULT_ABOUT_CONTENT as object
    }
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete:");
  // eslint-disable-next-line no-console
  console.log(`  Admin: admin@dogar.org / ${DEMO_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log(`  Demo members: *@example.com / ${DEMO_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log(`  Campaigns: ${campaigns.length}, Posts: ${posts.length}, Members: ${members.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
