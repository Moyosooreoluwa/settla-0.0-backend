import { PrismaClient } from '@prisma/client';
import express from 'express';
import asyncHandler from 'express-async-handler';
import { isAdmin, isAgent, isAuth } from '../middleware/auth';
import { estimateReadingTime, generateSlug } from '../utils/data';

const prisma = new PrismaClient();

const articleRouter = express.Router();
const now = new Date();

//get articles
articleRouter.get(
  '/featured',
  asyncHandler(async (req, res) => {
    const [latestArticles, popularArticles] = await Promise.all([
      prisma.article.findMany({
        where: { status: 'PUBLISHED', isDeleted: false },
        orderBy: { createdAt: 'desc' },
        include: { author: true },

        take: 8,
      }),
      prisma.article.findMany({
        where: { status: 'PUBLISHED', isDeleted: false },
        include: { author: true },

        orderBy: { views: 'desc' },
        take: 8,
      }),
    ]);

    res.json({
      latest: latestArticles,
      popular: popularArticles,
    });
  })
);

//get articles(search)
articleRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      page = '1',
      limit = '10',
      status = 'all',
      sort = 'newest',
      tags,
      q,
      category, // "latest" | "popular"
    } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
      tags?: string[] | string;
      q?: string;
      sort?: 'newest' | 'views_desc';
      category?: 'latest' | 'popular';
    };
    console.log(tags);

    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (pageNumber - 1) * pageSize;

    // --- Filters ---
    const coreFilters: any[] = [];

    if (status !== 'all') {
      coreFilters.push({ status });
      coreFilters.push({ isDeleted: false });
    } else {
      coreFilters.push({ status: 'PUBLISHED' }); // default to published
      coreFilters.push({ isDeleted: false });
    }

    // tags filter
    if (tags) {
      const capitalizeWords = (str: string) =>
        str.replace(/\b\w/g, (char) => char.toUpperCase());

      const tagArray = Array.isArray(tags)
        ? tags
        : tags
            .split(',')
            .map((a: string) => decodeURIComponent(a.trim()))
            .map(capitalizeWords);
      console.log(tagArray);

      coreFilters.push({ tags: { hasSome: tagArray } });
    }

    // search query filter
    if (q) {
      coreFilters.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    const where = coreFilters.length > 0 ? { AND: coreFilters } : {};

    // --- Sorting ---
    let orderBy: any[] = [];
    if (category === 'popular') {
      // category overrides sort → top viewed
      orderBy = [{ views: 'desc' }];
    } else if (category === 'latest') {
      // category overrides sort → newest
      orderBy = [{ createdAt: 'desc' }];
    } else {
      // fallback to normal sort
      if (sort === 'views_desc') {
        orderBy.push({ views: 'desc' });
      } else {
        orderBy.push({ createdAt: 'desc' });
      }
    }

    // --- Query ---
    const [articles, totalItems] = await prisma.$transaction([
      prisma.article.findMany({
        where,
        skip,
        take: pageSize,
        include: { author: true },
        orderBy,
      }),
      prisma.article.count({ where }),
    ]);
    console.log(articles);

    const [latestArticles, popularArticles] = await Promise.all([
      prisma.article.findMany({
        where: { status: 'PUBLISHED', isDeleted: false },
        orderBy: { createdAt: 'desc' },
        include: { author: true },
        take: 8,
      }),
      prisma.article.findMany({
        where: { status: 'PUBLISHED', isDeleted: false },
        orderBy: { views: 'desc' },
        take: 8,
      }),
    ]);

    res.json({
      articles,
      page: pageNumber,
      pages: Math.ceil(totalItems / pageSize),
      totalItems,
      latest: latestArticles,
      popular: popularArticles,
    });
  })
);

//get a single article
articleRouter.get(
  '/slug/:slug',
  asyncHandler(async (req, res) => {
    const { slug } = req.params;

    // 1. Fetch the main article
    const article = await prisma.article.findUnique({
      where: { slug },
      include: { author: true, Comments: { select: { commenter: true } } },
    });

    if (!article || article.isDeleted) {
      res.status(404).json({ message: 'Article not found' });
      return;
    }

    // 2. Fetch related articles by overlapping tags
    let related: any[] = [];
    if (article.tags && article.tags.length > 0) {
      related = await prisma.article.findMany({
        where: {
          tags: {
            hasSome: article.tags, // overlap on tags
          },
          id: { not: article.id }, // exclude the current article
          status: 'PUBLISHED',
          isDeleted: false, // only published ones
        },
        orderBy: { views: 'desc' }, // sort by popularity
        take: 6, // limit number of related results
      });
    }

    res.json({
      article,
      related,
    });
  })
);

//create an article
articleRouter.post(
  '/',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const {
      title,
      contentHTML,
      contentJSON,
      coverImage,
      tags,
    }: {
      title: string;
      contentHTML: string;
      contentJSON: string;
      coverImage: string;
      tags: string[];
    } = req.body;

    const authorId = req.user.id;

    if (
      !authorId ||
      !title ||
      !tags ||
      !coverImage ||
      !contentHTML ||
      !contentJSON
    )
      throw new Error('Insufficient Information');

    if (!authorId) throw new Error('Author not found');

    const author = await prisma.user.findUnique({ where: { id: authorId } });
    if (!author) throw new Error('Author not found');

    const slug = generateSlug(`${title} by ${author.name}`);

    const length = estimateReadingTime(contentHTML);

    const newArticle = await prisma.article.create({
      data: {
        title,
        contentHTML,
        contentJSON,
        coverImage,
        slug,
        tags,
        authorId,
        length,
      },
    });
    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_CREATE_ARTICLE',
      description: `${author.email} created a new article`,
      metadata: {
        article: newArticle,
        author,
        authorId,
      },
    });
    //TODO NOTIFY FOR APPROVAL

    res.status(201).json(newArticle);
  })
);

// change article status (admin)
articleRouter.post(
  '/status/:slug',
  isAuth,
  isAdmin,
  asyncHandler(async (req, res) => {
    const authorId = req.user.id;
    const { slug } = req.params;

    const {
      status,
    }: {
      status: 'PUBLISHED' | 'ARCHIVED' | 'DRAFT';
    } = req.body;

    const article = await prisma.article.findUnique({
      where: { slug },
      include: { author: true, Comments: { select: { commenter: true } } },
    });

    if (!article) {
      res.status(404).json({ message: 'Article not found' });
      return;
    }

    if (!authorId || authorId !== article.authorId)
      throw new Error('Author not found');

    if (!status) throw new Error('Insufficient Information');

    const updatedArticle = await prisma.article.update({
      where: { slug },
      data: {
        status,
      },
    });
    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_UPDATE_ARTICLE',
      description: `${article.author.email} updated article ${article.title} from ${article.status} to ${status}`,
      changes: { before: article, after: updatedArticle },
      metadata: {
        article: updatedArticle,
        authorId,
      },
    });
    //TODO NOTIFY FOR APPROVAL
  })
);
// archive article
articleRouter.patch(
  '/:id/archive',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const authorId = req.user.id;
    const { id } = req.params;

    const article = await prisma.article.findUnique({
      where: { id },
      include: { author: true, Comments: { select: { commenter: true } } },
    });

    if (!article) {
      res.status(404).json({ message: 'Article not found' });
      return;
    }

    if (!authorId || authorId !== article.authorId)
      throw new Error('Author not found');

    const updatedArticle = await prisma.article.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
      },
    });
    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_ARCHIVE_ARTICLE',
      description: `${article.author.email} archived article ${article.title}`,
      changes: { before: article, after: updatedArticle },
      metadata: {
        article: updatedArticle,
        authorId,
      },
    });
    //TODO NOTIFY FOR APPROVAL
    res.status(200).json({ message: 'Article archived.' });
  })
);

// unarchive article
articleRouter.patch(
  '/:id/unarchive',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const authorId = req.user.id;
    const { id } = req.params;

    const article = await prisma.article.findUnique({
      where: { id },
      include: { author: true, Comments: { select: { commenter: true } } },
    });

    if (!article) {
      res.status(404).json({ message: 'Article not found' });
      return;
    }

    if (!authorId || authorId !== article.authorId)
      throw new Error('Author not found');

    const updatedArticle = await prisma.article.update({
      where: { id },
      data: {
        status: 'DRAFT',
      },
    });
    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_UNARCHIVE_ARTICLE',
      description: `${article.author.email} unarchived article ${article.title}`,
      changes: { before: article, after: updatedArticle },
      metadata: {
        article: updatedArticle,
        authorId,
      },
    });
    //TODO NOTIFY FOR APPROVAL
    res.status(200).json({ message: 'Article unarchived.' });
  })
);
// delete article
articleRouter.delete(
  '/:id',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const authorId = req.user.id;
    const { id } = req.params;

    const article = await prisma.article.findUnique({
      where: { id },
      include: { author: true, Comments: { select: { commenter: true } } },
    });

    if (!article) {
      res.status(404).json({ message: 'Article not found' });
      return;
    }

    if (!authorId || authorId !== article.authorId)
      throw new Error('Author not found');

    const updatedArticle = await prisma.article.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: now,
      },
    });
    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_DELETE_ARTICLE',
      description: `${article.author.email} deleted article ${article.title}`,

      metadata: {
        article: updatedArticle,
        authorId,
      },
    });
    //TODO NOTIFY FOR APPROVAL
    res.status(200).json({ message: 'Article deleted.' });
  })
);

//edit an article
articleRouter.post(
  '/slug/:slug',
  isAuth,
  isAgent,
  asyncHandler(async (req, res) => {
    const {
      title,
      contentHTML,
      contentJSON,
      coverImage,
      tags,
    }: {
      title: string;
      contentHTML: string;
      contentJSON: string;
      coverImage: string;
      tags: string[];
    } = req.body;

    const { slug } = req.params;

    // 1. Fetch the main article
    const article = await prisma.article.findUnique({
      where: { slug },
      include: { author: true, Comments: { select: { commenter: true } } },
    });

    if (!article) {
      res.status(404).json({ message: 'Article not found' });
      return;
    }

    const authorId = req.user.id;

    if (authorId !== article.authorId) throw new Error('Author not found');

    if (
      !authorId ||
      !title ||
      !tags ||
      !coverImage ||
      !contentHTML ||
      !contentJSON
    )
      throw new Error('Insufficient Information');

    if (!authorId) throw new Error('Author not found');
    if (article.status === 'PUBLISHED')
      throw new Error('Article published and cannot be editted.');

    const author = await prisma.user.findUnique({ where: { id: authorId } });
    console.log(req.body, author);
    if (!author) throw new Error('Author not found');

    const newSlug = generateSlug(`${title} by ${author.name}`);
    const length = estimateReadingTime(contentHTML);

    const newArticle = await prisma.article.update({
      where: { slug },
      data: {
        title,
        contentHTML,
        contentJSON,
        coverImage,
        slug: newSlug,
        tags,
        authorId,
        length,
      },
    });
    await req.logActivity({
      category: 'USER_ACTION',
      action: 'USER_UPDATE_ARTICLE',
      description: `${author.email} updated article ${article.title}`,
      changes: { before: article, after: newArticle },
      metadata: {
        article: newArticle,
        author,
        authorId,
      },
    });
    //TODO NOTIFY FOR APPROVAL

    res.status(201).json(newArticle);
  })
);

//save an article
articleRouter.post(
  '/save-article/:id',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;

    const article = await prisma.article.findUnique({
      where: { id: id },
    });

    if (!article) {
      res.status(404).send({ message: 'Article not found' }); // Changed to .send and added return
      return;
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        saved_articles: {
          connect: { id: id },
        },
      },
    });

    await req.logActivity({
      category: 'ACCOUNT',
      action: 'USER_SAVE_ARTICLE',
      description: `${user.email} saved article ${article.id}.`,
      metadata: { user, userId, articleId: article.id, article },
    });

    res.status(200).json({ message: 'Article added to saved!' });
  })
);

//unsave an article
articleRouter.delete(
  '/unsave-article/:id',
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const { id } = req.params;

    const article = await prisma.article.findUnique({
      where: { id: id },
    });

    if (!article) {
      res.status(404).send({ message: 'Article not found' }); // Changed to .send and added return
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        saved_articles: {
          connect: { id: id },
        },
      },
    });

    await req.logActivity({
      category: 'ACCOUNT',
      action: 'USER_SAVE_ARTICLE',
      description: `${user.email} unsaved article ${article?.id}.`,
      metadata: { user, userId, articleId: article.id, article },
    });

    res.status(200).json({ message: 'Article removed from saved list.' });
  })
);

export default articleRouter;
