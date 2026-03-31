const functions = require("firebase-functions");
const admin = require("firebase-admin");
const PaytmChecksum = require("paytmchecksum");

admin.initializeApp();

/**
 * Initiate Paytm Payment
 * Generates Checksum and returns order details to the frontend
 */
exports.initiatePaytmPayment = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in to initiate payment."
    );
  }

  const { paymentId, amount } = data;
  const userId = context.auth.uid;

  // Paytm Credentials from Environment Variables
  const paytmMid = process.env.PAYTM_MID;
  const paytmMerchantKey = process.env.PAYTM_MERCHANT_KEY;
  const website = "WEBSTAGING"; // Use "DEFAULT" for production
  const callbackUrl = `https://${process.env.GCLOUD_PROJECT}.cloudfunctions.net/paytmCallback`;

  const paytmParams = {
    body: {
      requestType: "Payment",
      mid: paytmMid,
      websiteName: website,
      orderId: paymentId,
      callbackUrl: callbackUrl,
      txnAmount: {
        value: amount.toString(),
        currency: "INR",
      },
      userInfo: {
        custId: userId,
      },
    },
  };

  try {
    const checksum = await PaytmChecksum.generateSignature(
      JSON.stringify(paytmParams.body),
      paytmMerchantKey
    );

    return {
      mid: paytmMid,
      orderId: paymentId,
      checksum: checksum,
      txnAmount: amount.toString(),
      callbackUrl: callbackUrl,
    };
  } catch (error) {
    console.error("Paytm Checksum Generation Error:", error);
    throw new functions.https.HttpsError("internal", "Failed to initiate payment.");
  }
});

/**
 * Paytm Callback / Webhook
 * Receives payment status from Paytm, verifies checksum, and updates Firestore
 */
exports.paytmCallback = functions.https.onRequest(async (req, res) => {
  const paytmParams = req.body;
  const paytmMerchantKey = process.env.PAYTM_MERCHANT_KEY;

  const paytmChecksum = paytmParams.CHECKSUMHASH;
  delete paytmParams.CHECKSUMHASH;

  const isVerifySignature = PaytmChecksum.verifySignature(
    paytmParams,
    paytmMerchantKey,
    paytmChecksum
  );

  if (isVerifySignature) {
    console.log("Checksum Verified");

    const orderId = paytmParams.ORDERID;
    const status = paytmParams.STATUS; // TXN_SUCCESS or TXN_FAILURE
    const txnId = paytmParams.TXNID;

    const paymentStatus = status === "TXN_SUCCESS" ? "PAID" : "FAILED";

    try {
      await admin.firestore().collection("payments").doc(orderId).update({
        status: paymentStatus,
        transactionId: txnId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        paymentMethod: "Paytm",
      });

      // Redirect user back to the app (frontend URL)
      // Replace with your actual frontend URL
      const frontendUrl = `https://${process.env.GCLOUD_PROJECT}.web.app/payments`;
      res.redirect(frontendUrl);
    } catch (error) {
      console.error("Firestore Update Error:", error);
      res.status(500).send("Internal Server Error");
    }
  } else {
    console.error("Checksum Verification Failed");
    res.status(400).send("Checksum Mismatch");
  }
});
