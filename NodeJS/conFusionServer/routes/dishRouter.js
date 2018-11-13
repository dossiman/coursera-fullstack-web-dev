const express = require('express');
const createError = require('http-errors');
const Dishes = require('../models/dishes');
const auth = require('../authenticate');
const cors = require('./cors');

const dishRouter = express.Router();

getDishById = (dishId, populate = false) => {
  return new Promise((resolve, reject) => {
    let query = Dishes.findById(dishId);
    if (populate) {
      query = query.populate('comments.author');
    }
    query.then(dish => {
      if (dish != null) {
        resolve(dish);
      } else {
        reject(createError(404, `Dish ${dishId} not found`));
      }
    }, err => reject(err));
  });
};

getDishAndCommentById = (dishId, commentId, populate = false) => {
  return new Promise((resolve, reject) => {
    getDishById(dishId, populate)
        .then(dish => {
          const comment = dish.comments.id(commentId);
          if (comment != null) {
            resolve({ dish: dish, comment: comment });
          } else {
            reject(createError(404, `Comment ${commentId} not found`));
          }
        }, err => reject(err));
  });
};

dishRouter.route('/')
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, (req, res, next) => {
      Dishes.find({}).populate('comments.author')
          .then(dishes => res.json(dishes), err => next(err));
    })
    .post(cors.corsWithOptions, auth.verifyUser, auth.verifyAdmin, (req, res, next) => {
      Dishes.create(req.body).then(dishes => res.json(dishes), err => next(err));
    })
    .put(cors.corsWithOptions, auth.verifyUser, auth.verifyAdmin, (req, res) => {
      res.status(403).end(`PUT operation not supported on /dishes`);
    })
    .delete(cors.corsWithOptions, auth.verifyUser, auth.verifyAdmin, (req, res, next) => {
      Dishes.remove({}).then(resp => res.json(resp), err => next(err));
    });

dishRouter.route('/:dishId')
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, (req, res, next) => {
      getDishById(req.params.dishId, true)
          .then(dish => res.json(dish))
          .catch(err => next(err));
    })
    .post(cors.corsWithOptions, auth.verifyUser, auth.verifyAdmin, (req, res) => {
      res.status(403).end(`POST operation not supported on /dishes/${req.params.dishId}`);
    })
    .put(cors.corsWithOptions, auth.verifyUser, auth.verifyAdmin, (req, res, next) => {
      getDishById(req.params.dishId)
          .then(dish => {
            dish.set(req.body);
            return dish.save();
          })
          .then(dish => res.json(dish))
          .catch(err => next(err));
    })
    .delete(cors.corsWithOptions, auth.verifyUser, auth.verifyAdmin, (req, res, next) => {
      getDishById(req.params.dishId)
          .then(dish => dish.remove())
          .then(dish => res.json(dish))
          .catch(err => next(err));
    });

dishRouter.route('/:dishId/comments')
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, (req, res, next) => {
      getDishById(req.params.dishId, true)
          .then(dish => res.json(dish.comments))
          .catch(err => next(err));
    })
    .post(cors.corsWithOptions, auth.verifyUser, (req, res, next) => {
      getDishById(req.params.dishId)
          .then(dish => {
            req.body.author = req.user._id;
            dish.comments.push(req.body);
            return dish.save();
          })
          .then(dish => Dishes.findById(dish._id).populate('comments.author'))
          .then(dish => res.json(dish))
          .catch(err => next(err));
    })
    .put(cors.corsWithOptions, auth.verifyUser, (req, res) => {
      res.status(403).end(`PUT operation not supported on /dishes/${req.params.dishId}/comments`);
    })
    .delete(cors.corsWithOptions, auth.verifyUser, auth.verifyAdmin, (req, res, next) => {
      getDishById(req.params.dishId)
          .then(dish => {
            dish.comments = [];
            return dish.save();
          })
          .then(dish => res.json(dish))
          .catch(err => next(err));
    });

dishRouter.route('/:dishId/comments/:commentId')
    .options(cors.corsWithOptions, (req, res) => {
      res.sendStatus(200);
    })
    .get(cors.cors, (req, res, next) => {
      getDishAndCommentById(req.params.dishId, req.params.commentId, true)
          .then(({ comment }) => res.json(comment))
          .catch(err => next(err));
    })
    .post(cors.corsWithOptions, auth.verifyUser, (req, res) => {
      res.status(403).end(`POST operation not supported on /dishes/${req.params.dishId}/comments/${req.params.commentId}`);
    })
    .put(cors.corsWithOptions, auth.verifyUser, (req, res, next) => {
      getDishAndCommentById(req.params.dishId, req.params.commentId)
          .then(({ dish, comment }) => {
            if (req.user._id.equals(comment.author)) {
              if (req.body.rating) { comment.rating = req.body.rating; }
              if (req.body.comment) { comment.comment = req.body.comment; }
              return dish.save();
            } else {
              return Promise.reject(createError(403, 'You are not authorized to perform this operation!'));
            }
          })
          .then(dish => Dishes.findById(dish._id).populate('comments.author'))
          .then(dish => res.json(dish))
          .catch(err => next(err));
    })
    .delete(cors.corsWithOptions, auth.verifyUser, (req, res, next) => {
      getDishAndCommentById(req.params.dishId, req.params.commentId)
          .then(({ dish, comment }) => {
            if (req.user._id.equals(comment.author)) {
              comment.remove();
              return dish.save();
            } else {
              return Promise.reject(createError(403, 'You are not authorized to perform this operation!'));
            }
          })
          .then(dish => Dishes.findById(dish._id).populate('comments.author'))
          .then(dish => res.json(dish))
          .catch(err => next(err));
    });

module.exports = dishRouter;