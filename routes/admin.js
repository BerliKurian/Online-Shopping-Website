var express = require('express');
var router = express.Router();
var productHelper = require('../helpers/product-helper');
//const userHelper = require('../helpers/user-helper');
const path = require('path');

const ADMIN_USERNAME = 'berli';
const ADMIN_PASSWORD = 'pass1';

function isAuthenticated(req, res, next) {
  if (req.session.admin && req.session.admin.loggedIn) {
    return next();
  } else {
    res.redirect('/admin/login');
  }
}

function preventCache(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

router.get('/login', preventCache, (req, res) => {
  if (req.session.admin && req.session.admin.loggedIn) {
    let user=req.session.admin
    res.redirect('/admin/product');
  } else {
    res.render('admin/login', {
      loginErr: req.session.adminloginErr,
      layout: 'login-layout'
    });
    req.session.adminloginErr = null;
  }
});
router.get('/', preventCache, (req, res) => {
  if (req.session.admin && req.session.admin.loggedIn) {
    let user=req.session.admin
    res.redirect('/admin/product');
  } else {
    res.render('admin/login', {
      loginErr: req.session.adminloginErr,
      layout: 'login-layout'
    });
    req.session.adminloginErr = null;
  }
});


router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.admin = {
      username: ADMIN_USERNAME,
      loggedIn: true
    };
    res.redirect('/admin/product');
  } else {
    req.session.adminloginErr = "Invalid username or password";
    res.redirect('/admin/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).send('Internal Server Error');
    }
    res.redirect('/admin/login');
  });
});


router.get('/product', isAuthenticated, (req, res) => {
  let username = ADMIN_USERNAME
  productHelper.getAllProducts().then((products) => {
    res.render('admin/product', { products, username,admin: true });
  });
});
router.get('/users',isAuthenticated,(req,res)=>{
  let username= ADMIN_USERNAME;
productHelper.getAllUsers().then((users)=>{
  console.log("USERSSSS",users)
  
res.render('admin/users',{users, username,admin: true })
})
})

router.get('/add', isAuthenticated, (req, res) => {
  let username = ADMIN_USERNAME
  res.render('admin/add', { title: 'Add Product', admin: true ,username});
});

router.get('/remove', isAuthenticated, (req, res) => {
  let username = ADMIN_USERNAME
  productHelper.getAllProducts().then((products) => {
    res.render('admin/remove', { products, admin: true,username });
  });
});

router.get('/remove/:id', isAuthenticated, (req, res) => {
  
  let proid = req.params.id;
  productHelper.deleteProduct(proid).then(() => {
    res.redirect('/admin/remove');
  });
});

router.get('/edit', isAuthenticated, (req, res) => {
  let username = ADMIN_USERNAME
  productHelper.getAllProducts().then((products) => {
    res.render('admin/edit', { products, admin: true ,username});
  });
});

router.get('/edit-pro/:id', isAuthenticated, async (req, res) => {
  let proid = req.params.id;
  let username = ADMIN_USERNAME
  let product = await productHelper.getProductDetails(proid);
  res.render('admin/edit-pro', { product, admin: true ,username});
});

router.post('/edit-pro/:id', isAuthenticated, async (req, res, next) => {
  try {
    let proid = req.params.id;
    await productHelper.updateProduct(proid, req.body);

    if (req.files && req.files.image) {
      let image = req.files.image;
      await image.mv('./public/newimages/' + proid + '.jpg');
    }

    res.redirect('/admin/edit');
  } catch (err) {
    next(err);
  }
});

router.post('/submit', isAuthenticated, (req, res) => {
  productHelper.addProduct(req.body, req, (id) => {
    res.render("admin/add", { admin: true });
  });
});



router.get('/help', isAuthenticated, (req, res) => {
  let username = ADMIN_USERNAME
  res.render('admin/help', { admin: true ,username});
});



// Route to render order history page
router.get('/orders', isAuthenticated, async (req, res) => {
  try {
    let username = ADMIN_USERNAME; // Replace with actual admin username retrieval logic
    let orders = await productHelper.getOrderHistory();
    res.render('admin/orders', { layout: 'layout', admin: true, username, orders });
  } catch (err) {
    console.error("Error retrieving order history:", err);
    res.status(500).send("Internal Server Error");
  }
});


router.get('/earnings', isAuthenticated, async(req, res) => {
  let username = ADMIN_USERNAME
  cost = await productHelper.getTotalCost();
  res.render('admin/earnings', { admin: true,username,cost });
});

router.get('/graph', isAuthenticated, (req, res) => {
  let username = ADMIN_USERNAME
  res.render('admin/graph', { admin: true,username });
});

module.exports = router;
