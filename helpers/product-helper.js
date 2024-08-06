const db = require('../config/connection');
const collection = require('../config/collections');
const { ObjectId } = require('mongodb');

const fs = require('fs');
const path = require('path');

module.exports = {
  addProduct: (product, req, callback) => {
    console.log(product);
    db.get().collection(collection.PRODUCT_COLLECTION).insertOne(product)
      .then((data) => {
        console.log(data);
        const id = data.insertedId.toString();
        callback(id);

        let image1 = req.files?.image1;
        let image2 = req.files?.image2;

        const imagePath1 = path.join(__dirname, '../public/newimages', `${id}.jpg`);
        const imagePath2 = path.join(__dirname, '../public/newimages', `${id}_1.jpg`);

        if (image1) {
          image1.mv(imagePath1, (err) => {
            if (err) {
              console.error("Error moving image1:", err);
            }
          });
        }

        if (image2) {
          image2.mv(imagePath2, (err) => {
            if (err) {
              console.error("Error moving image2:", err);
            }
          });
        }
      })
      .catch(err => {
        console.error('Error adding product:', err);
        throw err;
      });
  },


  getAllProducts: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const products = await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray();
        resolve(products);
      } catch (err) {
        console.error('Error retrieving all products:', err);
        reject(err);
      }
    });
  },

  deleteProduct: (proid) => {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await db.get().collection(collection.PRODUCT_COLLECTION).deleteOne({ _id: new ObjectId(proid) });
        console.log(response);
        resolve(response);
      } catch (err) {
        console.error('Error deleting product:', err);
        reject(err);
      }
    });
  },

  getProductDetails: (proid) => {
    return new Promise(async (resolve, reject) => {
      try {
        const product = await db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: new ObjectId(proid) });
        resolve(product);
      } catch (err) {
        console.error('Error retrieving product details:', err);
        reject(err);
      }
    });
  },

  updateProduct: (proid, prodetails) => {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await db.get().collection(collection.PRODUCT_COLLECTION).updateOne(
          { _id: new ObjectId(proid) },
          {
            $set: {
              id: prodetails.id,
              description: prodetails.description,
              price: prodetails.price,
              category: prodetails.category
            }
          }
        );
        resolve(response);
      } catch (err) {
        console.error('Error updating product:', err);
        reject(err);
      }
    });
  },

  getProductHistory: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const orderItems = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
          { $unwind: '$products' },
          {
            $lookup: {
              from: collection.PRODUCT_COLLECTION,
              localField: 'products.item',
              foreignField: '_id',
              as: 'product'
            }
          },
          {
            $project: {
              item: '$products.item',
              quantity: '$products.quantity',
              product: { $arrayElemAt: ['$product', 0] }
            }
          }
        ]).toArray();
     //   console.log("Order Items:", orderItems);
        
        resolve(orderItems);
      } catch (err) {
        console.error('Error retrieving product history:', err);
        reject(err);
      }
    });
  },

  getAllUsers: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const users = await db.get().collection(collection.USER_COLLECTION).find({}).toArray();
        console.log("allusers",users)
        resolve(users);
      } catch (err) {
        console.error('Error retrieving all users:', err);
        reject(err);
      }
    });
  },

  getAllOrders: (userid) => {
    return new Promise(async (resolve, reject) => {
      try {

        const orders = await db.get().collection(collection.ORDER_COLLECTION).find({userid:new ObjectId(userid)}).toArray();
        console.log("All Orders for userid:", orders);
        resolve(orders);
      //  const allUserIds = orders.map(order => order.userid.toString());
      //  const UserIds = [...new Set(allUserIds)];
        
      } catch (err) {
        console.error('Error retrieving all orders:', err);
        reject(err);
      }
    });
  },

  getOrderUser: () => {
    return new Promise(async (resolve, reject) => {
      try {
        const orders = await db.get().collection(collection.ORDER_COLLECTION).find({}).toArray();
        const allUserIds = orders.map(order => order.userid.toString());
        const UserIds = [...new Set(allUserIds)];
        console.log("userid",UserIds)
        resolve(UserIds)
      } catch (err) {
        console.error('Error retrieving all orders:', err);
        reject(err);
      }
    });
  },
  getEachOrders: (userId) => {
    console.log("useriddddd",userId)
    return new Promise(async (resolve, reject) => {
        try {
            const orders = await db.get().collection(collection.ORDER_COLLECTION).find({ userid: new ObjectId(userId) }).toArray();
            console.log("order",orders)
            resolve(orders);
        } catch (err) {
            console.error('Error retrieving all orders:', err);
            reject(err);
        }
    });
  },





  getAllOrdersWithProductsAndUsers: async (userid) => {
    try {
      const orders = await db.get().collection(collection.ORDER_COLLECTION).find({}).toArray();

      const allUserIds = orders.map(order => order.userid.toString());
      const uniqueUserIds = [...new Set(allUserIds)];

      const userInfos = await db.get().collection(collection.USER_COLLECTION).find({
        _id: { $in: uniqueUserIds.map(id => new ObjectId(id)) }
      }).toArray();

      const ordersWithUsers = orders.map(order => {
        const userInfo = userInfos.find(user => user._id.toString() === order.userid.toString());
        return { ...order, user: userInfo };
      });

      const cartProducts = await getCartProducts(userid);

      const ordersWithProductsAndUsers = ordersWithUsers.map(order => {
        const userCartProducts = cartProducts.filter(cartItem => cartItem.user._id.toString() === order.userid.toString());
        return { ...order, cartProducts: userCartProducts };
      });

      console.log("Orders with Products and User Info:", ordersWithProductsAndUsers);
      ordersWithProductsAndUsers.forEach(order => {
        console.log(`Order ID: ${order._id}`);
        console.log(`Products for order:`, order.products);
        console.log(`User:`, order.user);
        console.log(`Cart Products:`, order.cartProducts);
      });

      return ordersWithProductsAndUsers;
    } catch (err) {
      console.error("Error retrieving orders, products, and user information:", err);
      throw err;
    }
  },

  getCartProducts: async (userid) => {
    try {
      if (!userid) {
        return []; // Return empty array if no user ID is provided
      }

      const cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
        { $match: { user: new ObjectId(userid) } },
        { $unwind: "$products" },
        {
          $lookup: {
            from: collection.PRODUCT_COLLECTION,
            localField: "products.item",
            foreignField: "_id",
            as: "product"
          }
        },
        {
          $project: {
            item: "$products.item",
            quantity: "$products.quantity",
            product: { $arrayElemAt: ["$product", 0] }
          }
        }
      ]).toArray();

      console.log("Cart Products:", cartItems);
      return cartItems;
    } catch (err) {
      console.error("Error in getCartProducts:", err);
      throw err;
    }
  },
  getOrderHistory :async () => {
    try {
      const orders = await db.get().collection(collection.ORDER_COLLECTION).find().toArray();

 console.log("Order History:", orders);
      for (let order of orders) {
        for (let product of order.products) {
          const productDetails = await db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: product.item });
          product.details = productDetails;
          console.log("photo",productDetails) // Add product details to the order
        }
      }
  
      return orders;
    } catch (error) {
      console.error("Error retrieving order history:", error);
      throw error;
    }
  },
  getProductsByCategory: (category) => {
    console.log(category)
    return new Promise(async (resolve, reject) => {
      try {
        const products = await db.get().collection(collection.PRODUCT_COLLECTION).find({ category: category }).toArray();
        console.log("products",products)
        resolve(products);
      } catch (error) {
        reject(error);
      }
    });
  },
  getTotalCost:async()=>
  {
    var cost=0
    const orders= await db.get().collection(collection.ORDER_COLLECTION).find().toArray();
    for(let order of orders){
      for(let product of order.products){
        const productDetails= await db.get().collection(collection.PRODUCT_COLLECTION).findOne({_id:product.item});
        if (productDetails) {
          cost += parseFloat(productDetails.price);

        } else {
          console.error(`Product not found for item ID: ${product.item}`);
        }
      }
    
    
    }
    return cost
  }
  

  }

  