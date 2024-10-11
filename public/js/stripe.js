import axios from 'axios';
import { showAlert } from './alert';

export const bookTour = async (tourId) => {
  // 1) Get checkout session from API

  const stripe = Stripe(
    'pk_test_51PwnySJKcGhsgPbIxZfOmOsof9Si9JFBBuUcWNqsOssyNll9kmGt9wRtRb1YgBhuKCCk9msVyOfS3gBpF5F7tGrp00elD4ywQB',
  );
  try {
    const session = await axios(
      `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`,
    );

    // // 2) Create checkout form + charge credit card

    // using windows location to redirect the user to the checkout page
    // if (session.data.session.url)
    //   window.location.href = session.data.session.url;

    // or using stripe.redirectToCheckout
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
