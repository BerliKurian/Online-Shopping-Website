const express = require('express');
const router = express.Router();
const productHelper = require('../helpers/product-helper');
const userHelper = require('../helpers/user-helper');

function isAuthenticated(req, res, next) {
  if (req.session.user && req.session.userloggedIn) {
    return next();
  } else {
    res.redirect('/login');
  }
}

// Middleware to prevent caching
function preventCache(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

router.get('/user-home', async (req, res) => {
  try {
    let cartcount = null;
    if (req.session.user) {
      cartcount = await userHelper.getcartcount(req.session.user._id);
    }

    const searchQuery = req.query.search;
    let query = {};

    if (searchQuery) {
      query = {
        $or: [
          { id: { $regex: searchQuery, $options: 'i' } },
          { category: { $regex: searchQuery, $options: 'i' } }
        ]
      };
    }

    console.log('Search Query:', query);

    let products;
    if (Object.keys(query).length > 0) {
      products = await userHelper.searchProducts(query);
    } else {
      products = await userHelper.getEveryProducts();
    }

    let user = req.session.user;
    res.render('user/user-home', { products, user, cartcount });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});


// Public route for home page
router.get('/', async (req, res, next) => {
  let user = req.session.user;
  let cartcount = null;
  if (req.session.user) {
    cartcount = await userHelper.getcartcount(req.session.user._id);
  }
  productHelper.getAllProducts().then((products) => {
    res.render('user/user-home', { products, user, cartcount,showSearchBar: true });
  }).catch((err) => {
    console.error("Error retrieving products:", err);
    next(err); // Pass the error to the error handler
  });
});
router.get('/category/:category', async (req, res, next) => {
  try {
    let user = req.session.user;
    let cartcount = null;
    if (req.session.user) {
      cartcount = await userHelper.getcartcount(req.session.user._id);
    }
    const category = req.params.category;
    const products = await productHelper.getProductsByCategory(category);
    res.render('user/category', { products, user, cartcount, category });
  } catch (err) {
    console.error("Error retrieving products:", err);
    next(err); // Pass the error to the error handler
  }
});


// Route to display login page
router.get('/login', preventCache, (req, res, next) => {
  if (req.session.user && req.session.userloggedIn) {
    res.redirect('/');
  } else {
    res.render('user/login', {
      loginErr: req.session.userloginErr,
      layout: 'login-layout'
    });
    req.session.userloginErr = null; // Clear the error message after rendering
  }
});

// Route to handle login
router.post('/login', (req, res, next) => {
  userHelper.Dologin(req.body).then((response) => {
    if (response.status) {
      req.session.user = response.user;
      req.session.userloggedIn = true;
      
      res.redirect('/');
    } else {
      req.session.userloginErr = "Invalid Username or Password!!";
      res.redirect('/login');
    }
  }).catch((err) => {
    console.error("Login error:", err);
    res.redirect('/login');
  });
});

// Protected route to view cart (requires authentication)
router.get('/cart', isAuthenticated, async (req, res) => {
  let user = req.session.user;
  let cartcount = null;
  if (req.session.user) {
    cartcount = await userHelper.getcartcount(req.session.user._id);
  }
  try {
    let products = await userHelper.getCartProducts(req.session.user._id);
    let total = await userHelper.getTotalAmount(req.session.user._id);
    res.render('user/cart', { layout: 'layout', products, user, cartcount, total,showSearchBar: false });
  } catch (err) {
    console.error("Error retrieving cart products:", err);
    res.status(500).send("Internal Server Error");
  }
});

router.post('/cart/add/:id', isAuthenticated, async (req, res) => {
  let user = req.session.user;

  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const productId = req.params.id;
    const userId = req.session.user._id;

    await userHelper.addTocart(productId, userId);

    // Get updated cart count after adding product
    let cartcount = await userHelper.getcartcount(userId);

    return res.json({ cartcount }); // Respond with the updated cart count
  } catch (err) {
    console.error("Error adding product to cart:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
});


router.post('/change-product-quantity', isAuthenticated, (req, res, next) => {
  const userId = req.session.user._id;
  const { product, cart, count, quantity } = req.body;

  userHelper.changeProductQuantity(userId, cart, product, count, quantity).then((response) => {
    res.json(response);
  }).catch((err) => {
    console.error("Error changing product quantity:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });
});

router.post('/removeProduct', isAuthenticated, (req, res, next) => {
  const userId = req.session.user._id;
  const { product, cart } = req.body;

  userHelper.removeProductFromCart(userId, cart, product).then((response) => {
    res.json(response);
  }).catch((err) => {
    console.error("Error removing product from cart:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });
});

router.get('/logout', (req, res, next) => {
  req.session.user=null
  req.session.userloggedIn=false
   
    res.redirect('/');
 
});

router.get('/newimages/:id', (req, res) => {
  const productId = req.params.id;
  // Assuming the images are stored in the 'public/newimages' directory
  res.sendFile(path.join(__dirname, '../public/newimages', `${productId}.jpg`));
});

router.get('/checkout', isAuthenticated, async(req, res) => {
  let user = req.session.user;
  let cartcount = null;
  if (req.session.user) {
    cartcount = await userHelper.getcartcount(req.session.user._id);
  }
  res.render('user/checkout', { layout: 'layout', user, cartcount });
});
router.post('/checkout', isAuthenticated, async (req, res) => {
  console.log(req.body);

  let products = await userHelper.getCartProductList(req.body.userid);
  let totalPrice = await userHelper.getTotalAmount(req.body.userid);

  userHelper.placeOrder(req.body, products, totalPrice).then((orderid) => {
    
    if (req.body['payment-method'] === 'Cash On Delivery') {
      res.json({ codSuccess: true });
    } else {
      userHelper.generateRazorpay(orderid, totalPrice * 100).then((response) => {
        res.json({ razorpayOrderId: response.id,receipt: response.receipt  });
        console.log("the receipt number is",response.receipt)
      });
    }
  });
});



router.get('/ordersuccess', isAuthenticated,async(req, res) => {
  let user = req.session.user;
  if (req.session.user) {
    cartcount = await userHelper.getcartcount(req.session.user._id);
  }
  res.render('user/ordersuccess', { layout: 'layout', user ,cartcount});
});
// user.js

// Update the route for /orderhistory to fetch and render order history
router.get('/orderhistory', isAuthenticated, async (req, res) => {
  try {
    let user = req.session.user;
    let cartcount = await userHelper.getcartcount(req.session.user._id);
    let orders = await userHelper.getProductHistory(req.session.user._id);
    console.log("FINE TILL HERE")
    res.render('user/orderhistory', { layout: 'layout', user, cartcount,orders });
  } catch (err) {
    console.error("Error retrieving order history:", err);
    res.status(500).send("Internal Server Error");
  }
});
// router.get('/product-history/:id', isAuthenticated, async (req, res) => {

//     router.get('/orders', isAuthenticated, async (req, res) => {
//       try {
//         let orders = await userHelper.getProductHistory(req.params.id);
//         res.render('user/product-history', { order, layout: false });
//       } catch (err) {
//         console.error("Error retrieving order history:", err);
//         res.status(500).send("Internal Server Error");
//       }
//     });
//   })


router.get('/get-total-price', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user._id;
    console.log("useriddddddddddddddddddddddd",userId)
    const total = await userHelper.getTotalAmount(userId); // 
    res.json({ total });
  } catch (err) {
    console.error('Error getting total price:', err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
router.post('/verify-payment', (req, res) => {
  console.log("lastttttttttttttttttttttt",req.body)
  userHelper.verifyPayment(req.body).then(() => {
    userHelper.changepaymentStatus(req.body.receipt).then(() => {
      console.log("Payment status changed successfully.");
      res.json({ status: true });
    }).catch((err) => {
      console.error('Error changing payment status:', err);
      res.json({ status: false, errMsg: err.message || 'Failed to change payment status' });
    });
  }).catch((err) => {
    console.error('Error verifying payment:', err);
    res.json({ status: false, errMsg: err.message || 'Failed to verify payment' });
  });
});


module.exports = router;
