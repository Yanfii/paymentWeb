'use strict';

let express = require('express');
let bodyParser = require('body-parser');
let config = require('./config');
let shippo = require('shippo')(config.shippoKey);
let stripe = require('stripe')(config.stripeKey);

let app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

/**
 * Calculates the shipping price.
 */
app.post('/ship', function(req, res) {
  let addressLines = req.body.addressLine;
  if (req.body.dependentLocality.length > 0) {
    addressLines.push(req.body.dependentLocality);
  }

  let postalCode = req.body.postalCode;
  if (req.body.sortingCode.length > 0) {
    if (postalCode.length > 0) {
      addressLines.push(req.body.sortingCode);
    } else {
      postalCode = req.body.sortingCode;
    }
  }

  let street1 = '';
  if (addressLines.length > 0) {
    street1 = addressLines[0];
  }

  let street2 = '';
  if (addressLines.length > 1) {
    street2 = addressLines.slice(1).join(', ');
  }

  let shipment = {
    object_purpose: 'PURCHASE',
    address_from: {
      object_purpose: 'PURCHASE',
      name: 'Rouslan Solomakhin',
      company: 'Google',
      street1: '340 Main St',
      street2: '',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90291',
      country: 'US',
      phone: '310-310-6000',
      email: 'test.source@test.com',
    },
    address_to: {
      object_purpose: 'PURCHASE',
      name: req.body.recipient,
      company: req.body.organization,
      street1: street1,
      street2: street2,
      city: req.body.city,
      state: req.body.region,
      zip: postalCode,
      country: req.body.country,
      phone: req.body.phone,
      email: 'test.destination@test.com',
    },
    parcel: {
      length: '5',
      width: '5',
      height: '5',
      distance_unit: 'in',
      weight: '2',
      mass_unit: 'lb',
    },
    async: false,
  };

  shippo.shipment.create(shipment, function(err, shipment) {
    let result = {};
    if (err) {
      console.log(err);
      result.status = 'fail';
      result.message = 'Error calculating shipping options';
      res.status(200).send(JSON.stringify(result));
      return;
    }

    result.status = 'success';
    result.message = 'Calculated shipping options';
    result.shippingOptions = [];

    let minAmount = -1;
    let minIndex = -1;
    for (let i in shipment.rates_list) {
      if ({}.hasOwnProperty.call(shipment.rates_list, i)) {
        let rate = shipment.rates_list[i];

        let amountNumber = Number(rate.amount);
        if (minAmount === -1 || minAmount > amountNumber) {
          minAmount = amountNumber;
          minIndex = i;
        }

        let option = {
          id: rate.object_id,
          label: rate.provider + ' ' + rate.servicelevel_name,
          amount: {currency: rate.currency, value: rate.amount},
          selected: false,
        };

        result.shippingOptions.push(option);
      }
    }

    if (minIndex !== -1) {
      result.shippingOptions[minIndex].selected = true;
    }

    res.status(200).send(JSON.stringify(result));
  });
});

/**
 * Authorizes and Android Pay token for USD $0.50 via Stripe.
 */
app.post('/buy', function(req, res) {
  const errorString = JSON.stringify({
    status: 'fail',
    message: 'Invalid request',
  });

  if (!req.body
      || !req.body.methodName
      || req.body.methodName !== 'https://android.com/pay'
      || !req.body.details
      || !req.body.details.paymentMethodToken
      || !JSON.parse(req.body.details.paymentMethodToken).id) {
    res.status(200).send(errorString);
    return;
  }

  stripe.charges.create({
    amount: 50,
    currency: 'usd',
    source: JSON.parse(req.body.details.paymentMethodToken).id,
    description: 'Web payments demo',
    capture: false,
  }, function(err, charge) {
    if (err) {
      res.status(200).send(errorString);
    } else {
      res.status(200).send(JSON.stringify({
        status: 'success',
        message: 'Payment authorized',
      }));
    }
  });
});

app.head('/test', function(req, res) {
  res.status(200).links({
    'payment-method-manifest':
        'https://yanfii.github.io/test/bobpay/payment-manifest.json',
  }).end();
});

/**
 * Starts the server.
 */
if (module === require.main) {
  let server = app.listen(process.env.PORT || 8080, function() {
    console.log('App listening on port %s', server.address().port);
  });
}

module.exports = app;
