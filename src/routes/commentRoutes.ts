import { PrismaClient } from '@prisma/client';
import express from 'express';
import { isAuth } from '../middleware/auth';
import asyncHandler from 'express-async-handler';

const prisma = new PrismaClient();

const commentRouter = express.Router();

// Comment on an article
commentRouter.post(
  '/:id',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { commenterId, comment, rating } = req.body;
    const article = await prisma.article.findUnique({
      where: { id },
      include: { Comments: true },
    });

    if (!article) {
      res.status(404).send({ message: 'Article not found' });
      return;
    }

    if (article.authorId === req.user.id) {
      res.status(400).send({ message: 'You cannot comment on your article. ' });
      return;
    }

    if (
      article.Comments.find(
        (x) => x.commenterId === req.user.id && x.isDeleted === false
      )
    ) {
      res.status(400).send({ message: 'You already submitted a comment' });
      return;
    }

    const newComment = await prisma.comment.create({
      data: {
        commenterId,
        comment,
        articleId: article.id,
      },
      include: { commenter: true },
    });

    await req.logActivity({
      category: 'ACCOUNT',
      action: 'USER_POST_COMMENT',
      description: `${newComment.commenter.email} posted a comment on article ${article.title}.`,
      metadata: {
        article,
        comment: newComment,
        commenter: newComment.commenter,
      },
    });

    res.status(201).send({
      message: 'Comment submitted',
      comment: newComment,
    });
  })
);

//edit a comment
commentRouter.put(
  '/:id',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;

    const updatedComment = await prisma.comment.update({
      where: { id },
      data: {
        comment,
      },
      include: { commenter: true, article: true },
    });

    await req.logActivity({
      category: 'ACCOUNT',
      action: 'USER_POST_COMMENT',
      description: `${updatedComment.commenter.email} updated a comment on article ${updatedComment.article.title}.`,
      metadata: {
        user: updatedComment.commenter,
        comment: updatedComment,
        article: updatedComment.article,
      },
    });

    res.status(201).send({
      message: 'Comment Edited',
      comment: updatedComment,
    });
  })
);

//delete a comment
commentRouter.delete(
  '/:id',
  isAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const now = new Date();
    const deletedComment = await prisma.comment.update({
      where: { id },
      include: { commenter: true, article: true },
      data: { isDeleted: true, deletedAt: now },
    });

    await req.logActivity({
      category: 'ACCOUNT',
      action: 'USER_DELETE_COMMENT',
      description: `${deletedComment.commenter.email} (soft) deleted a comment on ${deletedComment.article.title}.`,
      metadata: {
        article: deletedComment.article,
        comment: deletedComment,
        commenter: deletedComment.commenter,
      },
    });

    res.status(201).send({
      message: 'Comment Deleted',
    });
  })
);

commentRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const comments = await prisma.comment.findMany({
      where: { articleId: id, isDeleted: false },
      include: { commenter: true },
    });

    res.status(200).json({ comments });
  })
);

export default commentRouter;
