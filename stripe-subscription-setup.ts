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

interface CreateSubscriptionProps {
  customerId: string;
  priceId: string;
  startDate?: Date;
  endDate?: Date;
  trialEndDate?: Date;
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

const createSubscription = async (props: CreateSubscriptionProps) => {
  const { customerId, priceId, startDate, endDate, trialEndDate } = props;

  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price: priceId }],
  };

  // Set the billing cycle anchor (start date)
  if (startDate) {
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    subscriptionParams.billing_cycle_anchor = startTimestamp;
    subscriptionParams.proration_behavior = 'none';
  }

  // Set trial end date (delays first payment)
  if (trialEndDate) {
    subscriptionParams.trial_end = Math.floor(trialEndDate.getTime() / 1000);
  }

  // Set the end date (cancel_at)
  if (endDate) {
    subscriptionParams.cancel_at = Math.floor(endDate.getTime() / 1000);
  }

  return stripe.subscriptions.create(subscriptionParams);
};

// For more complex scenarios with multiple phases
interface SubscriptionScheduleProps {
  customerId: string;
  phases: {
    priceId: string;
    startDate: Date;
    endDate: Date;
  }[];
}

const createSubscriptionSchedule = async (props: SubscriptionScheduleProps) => {
  const { customerId, phases } = props;

  const schedulePhases: Stripe.SubscriptionScheduleCreateParams.Phase[] =
    phases.map((phase) => ({
      items: [{ price: phase.priceId }],
      start_date: Math.floor(phase.startDate.getTime() / 1000),
      end_date: Math.floor(phase.endDate.getTime() / 1000),
    }));

  return stripe.subscriptionSchedules.create({
    customer: customerId,
    start_date: Math.floor(phases[0].startDate.getTime() / 1000),
    end_behavior: 'cancel',
    phases: schedulePhases,
  });
};

export {
  createProduct,
  createPrice,
  createProductAndPrices,
  createSubscription,
  createSubscriptionSchedule,
};
