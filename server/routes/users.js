const express = require('express');
const router = express.Router();
const { User } = require("../models/User");
const { Product } = require("../models/Product");

const { auth } = require("../middleware/auth");

//=================================
//             User
//=================================

router.get("/auth", auth, (req, res) => {
    // it will show the following details in redux store userData

    const {_id, role, email, name, lastName, image, cart} = req.user;

    res.status(200).json({
        _id,
        email,
        name,
        lastName,
        image,
        cart,
        role,
        isAdmin: role === 0 ? false : true,
        isAuth: true,
    });
});

router.post("/register", (req, res) => {

    const user = new User(req.body);

    user.save((err, doc) => {
        if (err) return res.json({ success: false, err });
        return res.status(200).json({
            success: true
        });
    });
});

router.post("/login", (req, res) => {
    User.findOne({ email: req.body.email }, (err, user) => {
        if (!user)
            return res.json({
                loginSuccess: false,
                message: "Auth failed, email not found"
            });

        user.comparePassword(req.body.password, (err, isMatch) => {
            if (!isMatch)
                return res.json({ loginSuccess: false, message: "Wrong password" });

            user.generateToken((err, user) => {
                if (err) return res.status(400).send(err);
                res.cookie("w_authExp", user.tokenExp);
                res
                    .cookie("w_auth", user.token)
                    .status(200)
                    .json({
                        loginSuccess: true, userId: user._id
                    });
            });
        });
    });
});

router.get("/logout", auth, (req, res) => {
    User.findOneAndUpdate({ _id: req.user._id }, { token: "", tokenExp: "" }, (err, doc) => {
        if (err) return res.json({ success: false, err });
        return res.status(200).send({
            success: true
        });
    });
});

router.post('/addToCart', auth, (req, res) => {
    // this .user in the req after pass the auth
    const {_id} = req.user;
    const {productId} = req.query;

    User.findOne({_id}, (err, userInfo) => {

        // whether this new coming product already in the cart or not
        let duplicate = false;

        userInfo.cart.forEach((cartInfo) => {
            if (cartInfo.id === productId) {
                // this product already exists in the cart
                duplicate = true;
            }
        });

        if (duplicate) {
            // if this product in the cart already then update it (quantity + 1)
            User.findOneAndUpdate(
                {_id, 'cart.id': productId},
                {$inc: {'cart.$.quantity': 1}},
                {new: true},
                () => {
                    if (err) {
                        return res.json({success: false, err});
                    }
                    return res.status(200).json(userInfo.cart);
                }
            );
        } else {
            // if this product is NOT in the cart now (quantity = 1)
            User.findOneAndUpdate(
                {_id},
                {
                    $push: {
                        cart: {
                            id: productId,
                            quantity: 1,
                            date: Date.now()
                        }
                    }
                },
                {new: true},
                () => {
                    if (err) {
                        return res.json({success: false, err});
                    }
                    return res.status(200).json(userInfo.cart);
                }
            );
        }
    });
});

router.get('/removeFromCart', auth, (req, res) => {

    const {_id} = req.user;
    const {_id: productId} = req.query;

    User.findOneAndUpdate(
        {_id},
        {
            $pull: {
                cart: {
                    id: productId
                }
            }
        },
        {new: true},
        (err, userInfo) => {
            let {cart} = userInfo;
            let cartItemsIdArray = [];
            cart.forEach(item => cartItemsIdArray = [...cartItemsIdArray, item.id]);

            // go to Product model
            Product.find({'_id': {$in: cartItemsIdArray}})
                .populate('writer')
                .exec((err, products) => {
                    return res.status(200).json({
                        cart, // in reducer
                        cartDetails: products // in reducer
                    });
                });
        }
    );
});

module.exports = router;
