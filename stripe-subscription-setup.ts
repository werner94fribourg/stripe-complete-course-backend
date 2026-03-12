import { config } from 'dotenv';
import Stripe from 'stripe';

config({ path: '.env' });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(STRIPE_SECRET_KEY!);

interface ProductProps {
  name: string;
  description: string;
}

interface SubscriptionProps {
  product: string;
  currency: string;
  recurring: { interval: Stripe.PriceCreateParams.Recurring.Interval };
  unit_amount: number;
  lookup_key: string;
}

interface SubscriptionsProps {
  product: string;
  currency: string;
  ranges: {
    recurring: { interval: Stripe.PriceCreateParams.Recurring.Interval };
    unit_amount: number;
    lookup_key: string;
  }[];
}

const createProduct = (props: ProductProps) => {
  return stripe.products.create(props);
};

const createPrice = (props: SubscriptionProps) => {
  return stripe.prices.create(props);
};

const createProductAndPrices = async (
  productProps: ProductProps,
  subscriptionProps: SubscriptionsProps,
) => {
  // Setup script to create a Product (important to create it for subscription)
  const product = await createProduct(productProps);

  const { product: productId, currency, ranges } = subscriptionProps;

  // Setup recurring prices associated with the product - need currency, associated product, recurring interval (month, ...)
  const prices = await Promise.all(
    ranges.map(({ recurring, unit_amount, lookup_key }) =>
      createPrice({
        product: productId,
        currency,
        recurring,
        unit_amount,
        lookup_key,
      }),
    ),
  );

  return { product, prices };
};
