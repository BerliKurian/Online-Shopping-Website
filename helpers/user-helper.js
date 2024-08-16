const db = require('../config/connection');
const collection = require('../config/collections');
const bcrypt = require('bcrypt');
const {  ObjectId } = require('mongodb');
//const { resolve, reject } = require('promise');
const Razorpay=require('razorpay')
var instance = new Razorpay({
  key_id: 'rzp_test_NqoC3Uai9RtEKG',
  key_secret: 'irstMADmFYumXS7XKg0Y2P55',
});

module.exports = {
  DoSignup: (userdata) => {
    return new Promise(async (resolve, reject) => {
      try {
        let user = await db.get().collection(collection.USER_COLLECTION).findOne({ email: userdata.email });
        if (user) {
          console.log("User already exists");
          resolve({ status: false, message: "User already exists" });
        } else {
          userdata.password = await bcrypt.hash(userdata.password, 10);
          let result = await db.get().collection(collection.USER_COLLECTION).insertOne(userdata);
          resolve({ status: true });
        }
      } catch (err) {
        reject(err);
      }
    });
  },
  Dologin: (userdata) => {
    return new Promise(async (resolve, reject) => {
      try {
        let user = await db.get().collection(collection.USER_COLLECTION).findOne({ email: userdata.email });
        if (user) {
          let status = await bcrypt.compare(userdata.password, user.password);
          if (status) {
            console.log("Login success");
            resolve({ status: true, user });
          } else {
            console.log("Login failed");
            resolve({ status: false });
          }
        } else {
          console.log("Login failed");
          resolve({ status: false });
        }
      } catch (err) {
        reject(err);
      }
    });
  },
  addTocart: (proid, userid) => {
    proObj={
      item: new ObjectId(proid),
      quantity:1
    }
    return new Promise(async (resolve, reject) => {
      try {
        let userCart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new ObjectId(userid) }); //if cart already assigned
        if (userCart) {
          let proExist = userCart.products.findIndex(product=> product.item==proid)
          if(proExist!=-1) //same product then only update count
            {
              db.get().collection(collection.CART_COLLECTION).updateOne({user:new ObjectId(userid),
                'products.item':new ObjectId(proid)},
                {
                  $inc:{'products.$.quantity':1}
                }
            ).then(()=>{
              resolve()
            })

            }else{ //diff pro add
         
          console.log(proExist)
          await db.get().collection(collection.CART_COLLECTION).updateOne(
            { user: new ObjectId(userid) },
            { $push: { products: proObj } }
          ).then((response)=>
          {
            resolve();
          })};
        } else { //no cart first item
          let cartObject = {
            user: new ObjectId(userid),
            products: [ proObj]
          };
          await db.get().collection(collection.CART_COLLECTION).insertOne(cartObject);
        }
        resolve();
      } catch (err) {
        console.error("Error in addTocart:", err);
        reject(err);
      }
    });
  },
  
  
      getCartProducts: (userid) => {
          return new Promise(async (resolve, reject) => {
              try {
                  if (!userid) {
                      resolve([]); 
                      return;
                  }
  
                  let cartitems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                      {
                          $match: { user: new ObjectId(userid) } 
                      },
                      {
                        $unwind:'$products'

                      },
                      {
                        $project:{ //project it
                          item:'$products.item',
                          quantity:'$products.quantity'
                        }
                      },{
                        $lookup:{
                          from:collection.PRODUCT_COLLECTION,
                          localField:'item', //cart collection
                        
                          foreignField:'_id', //product collection which field
                          as:'product'
                        }
                      },
                      {
                        $project:
                        {
                          item:1,quantity:1,product: {$arrayElemAt:['$product',0]}    //if u need item and qauntity to project(display) then set to 1 
                        }
                      }
                      
                       
                  ]).toArray();
                  console.log(cartitems);
                  resolve(cartitems);
  
                  if (cartitems.length > 0) {
                      resolve(cartitems); // Resolve with cart items
                  } else {
                      resolve([]); // Resolve with empty array if cart is empty
                  }
              } catch (err) {
                  console.error("Error in getCartProducts:", err);
                  reject(err);
              }
          });
      },
      getcartcount:(userid)=>
        {
          let count=0
          return new Promise(async(resolve,reject)=>
            {
              let cart=await db.get().collection(collection.CART_COLLECTION).findOne({user:new ObjectId(userid)})
              if(cart)
                {
                  count=cart.products.length
                }
                resolve(count)
            
            })
        },
        changeProductQuantity: (userId, cartId, productId, count, quantity) => {
          count = parseInt(count);
          quantity = parseInt(quantity);
      
          return new Promise((resolve, reject) => {
            if (count === -1 && quantity === 1) {
              // Remove the product from the cart if the count is -1 and quantity is 1
              db.get().collection(collection.CART_COLLECTION).updateOne(
                { _id: new ObjectId(cartId), 'products.item':new ObjectId(productId) },
                {
                  $pull: { products: { item: new ObjectId(productId) } },
                }
              ).then((response) => {
                resolve({ removeProduct: true });
              }).catch((err) => {
                console.error("Error removing product from cart:", err);
                reject(err);
              });
            } else {
              // Update the quantity in the cart
              db.get().collection(collection.CART_COLLECTION).updateOne(
                { _id: new ObjectId(cartId), 'products.item': new ObjectId(productId) },
                {
                  $inc: { 'products.$.quantity': count },
                }
              ).then((response) => {
                resolve({ removeProduct: false });
              }).catch((err) => {
                console.error("Error updating product quantity:", err);
                reject(err);
              });
            }
          });
        },
      
        removeProductFromCart: (userId, cartId, productId) => {
          return new Promise((resolve, reject) => {
            db.get().collection(collection.CART_COLLECTION).updateOne(
              { _id: new ObjectId(cartId), 'products.item': new ObjectId(productId) },
              {
                $pull: { products: { item: new ObjectId(productId) } },
              }
            ).then((response) => {
              resolve({ removeProduct: true });
            }).catch((err) => {
              console.error("Error removing product from cart:", err);
              reject(err);
            });
          });
        },
        getTotalAmount:(userid)=>
          {
            return new Promise(async (resolve, reject) => {
              
                
                  let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
                      {
                          $match: { user: new ObjectId(userid) } 
                      },
                      {
                        $unwind:'$products'

                      },
                      {
                        $project:{ //project it
                          item:'$products.item',
                          quantity:'$products.quantity'
                        }
                      },{
                        $lookup:{
                          from:collection.PRODUCT_COLLECTION,
                          localField:'item', //cart collection
                        
                          foreignField:'_id', //product collection which field
                          as:'product'
                        }
                      },
                      {
                        $project:
                        {
                          item:1,quantity:1,product: {$arrayElemAt:['$product',0]}    //if u need item and qauntity to project(display) then set to 1 
                        }
                      }
                      ,{
                        $project: {
                          item: 1,
                          quantity: 1,
                          product: 1,
                          quantity: { $toDouble: '$quantity' },
                          price: { $toDouble: '$product.price' }
                        }
                      },{
                        $group:
                        {
                          _id:null,
                    total:{$sum:{$multiply:['$quantity','$price']}}

                        }
                      }
                       
                  ]).toArray();
                  console.log(total);
                  
                  if (total.length > 0) {
                    resolve(total[0].total);
                  } else {
                    resolve(0); // Return 0 if no products are found in the cart
                  }
                }
              )
        
      },
      placeOrder:(order, products, total) => {
        let date = new Date();
        let today = date.toDateString();
        let expectedDeliveryDate = new Date(date);
        expectedDeliveryDate.setDate(date.getDate() + 7);
        let formattedDeliveryDate = expectedDeliveryDate.toDateString();
      
        return new Promise((resolve, reject) => {
          console.log(order, products, total);
          let status = order['payment-method'] === 'Cash On Delivery' ? 'PLACED' : 'FAILED';
          let orderObj = {
            deliveryDetails: {
              mobile: order.phone,
              address: order.address,
              pincode: order.pincode,
            },
            userid: new ObjectId(order.userid),
            paymentMethod: order['payment-method'],
            products: products,
            status: status,
            Date: today,
            DeliveryDate: formattedDeliveryDate
          };
      
          db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response) => {
            db.get().collection(collection.CART_COLLECTION).deleteOne({ user: new ObjectId(order.userid) });
            resolve(response.insertedId);
          }).catch((err) => {
            reject(err);
          });
        });
      },
        getCartProductList:(userid)=>{
          return new Promise(async(resolve,reject)=>
            {
              let cart=await db.get().collection(collection.CART_COLLECTION).findOne({user: new ObjectId(userid)})
              console.log("CHECKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK",cart.products)
              resolve(cart.products)
   
         } )
        },
        // userHelper.js

// Add a function to fetch order history
getOrderHistory: (userId) => {
  return new Promise(async (resolve, reject) => {
    //ch orders from the ORDER_COLLECTION based on user ID
      let orders = await db.get().collection(collection.ORDER_COLLECTION)
        .find({ userid: new ObjectId(userId) })
        .toArray();
        resolve(orders)
        console.log("ORDERSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",orders)
        })
      },
    //   getProductHistory :async (userid) => {
    //     try {
    //       const orders = await db.get().collection(collection.ORDER_COLLECTION).find().toArray();
    
    //  console.log("Order History:", orders);
    //       for (let order of orders) {
    //         for (let product of order.products) {
    //           const productDetails = await db.get().collection(collection.PRODUCT_COLLECTION).findOne({ user: new ObjectId(userid)});
    //           product.details = productDetails;
    //           console.log("photo",productDetails) // Add product details to the order
    //         }
    //       }
      
    //       return orders;
    //     } catch (error) {
    //       console.error("Error retrieving order history:", error);
    //       throw error;
    //     }
    //   }
    getProductHistory :async (userid) => {
        return new Promise(async (resolve, reject) => {
          //ch orders from the ORDER_COLLECTION based on user ID
            let orders = await db.get().collection(collection.ORDER_COLLECTION)
              .find({ userid: new ObjectId(userid) })
              .toArray();
              for (let order of orders) {
                for (let product of order.products) {
                  const productDetails = await db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: product.item });
                  product.details = productDetails;
                  console.log("photo",productDetails) // Add product details to the order
                }
              }
              console.log("OK",orders)
              resolve(orders);
            })
          },
         

generateRazorpay:(orderid,totalPrice)=>
{
  return new Promise((resolve,reject)=>
    {
      var options = {
        amount: totalPrice,  // amount in the smallest currency unit
        currency: "INR",
        receipt: orderid
      };
      instance.orders.create(options, function(err, order) {
        if(err)
         {
             console.log(err);
           }          
           console.log("ORDER RAZOR PAY",order);
        resolve(order)
      });

    })

},
verifyPayment: (paymentDetails) => {
  return new Promise((resolve, reject) => {
    // Example verification logic using crypto module (replace with actual logic)
    var crypto = require('crypto');
    var hmac = crypto.createHmac('sha256', 'irstMADmFYumXS7XKg0Y2P55'); // Replace with your actual secret key
    hmac.update(paymentDetails['payment[razorpay_order_id]'] + '|' + paymentDetails['payment[razorpay_payment_id]']);
    var calculatedSignature = hmac.digest('hex');

    // Compare calculated signature with received signature
    if (calculatedSignature === paymentDetails['payment[razorpay_signature]']) {
      resolve(); // Payment verification successful
    } else {
      reject(new Error('Payment verification failed'));
    }
  });
},

changepaymentStatus: (orderId) => {
  return new Promise((resolve, reject) => {
    
    db.get().collection(collection.ORDER_COLLECTION).updateOne(
      { _id: new ObjectId(orderId) },
      { $set: { status: 'PLACED' } }
    ).then(() => {
      resolve(); 
    }).catch((err) => {
      reject(err); // 
    });
  });
},
searchProducts: (query) => {
  return new Promise(async (resolve, reject) => {
    try {
      const products = await db.get().collection(collection.PRODUCT_COLLECTION).find(query).toArray();
      resolve(products);
    } catch (error) {
      reject(error);
    }
  });
},

getEveryProducts: () => {
  return new Promise(async (resolve, reject) => {
    try {
      const products = await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray();
      resolve(products);
    } catch (error) {
      reject(error);
    }
  });
},


};

  
