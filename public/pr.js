/**
 * Show the msg to the user.
 *
 * @private
 * @param {string} msg The message to print in the 'live output' section of the
 * page.
 */
function print(msg) {
  let element = document.getElementById('msg');
  element.innerHTML = element.innerHTML + '<br>' + msg;
}

/**
 * Notify Chrome that the instrument authorization has completed.
 *
 * @private
 * @param {PaymentResponse} instrument The payment instrument that was authed.
 * @param {string} result Whether the auth was successful. Should be either
 * 'success' or 'fail'.
 * @param {string} msg The message to print in the 'live output' section of the
 * page after the browser hides its UI.
 */
function complete(instrument, result, msg) {
  instrument.complete(result).then(function() {
    print(msg);
  }).catch(function(error) {
    print(error);
  });
}

/**
 * Lets the user know that shipping is not possible.
 *
 * @private
 * @param {string} message The message to print in the 'live output' section of
 * the page.
 * @param {PaymentDetails} details The details for payment.
 * @param {function} callback The callback to invoke.
 */
function cannotShip(message, details, callback) {
  print(message);
  delete details.shippingOptions;
  callback(details);
}

/**
 * Lets the user know that shipping is possible.
 *
 * @private
 * @param {PaymentDetails} details The details for payment.
 * @param {Array} shippingOptions The shipping options.
 * @param {function} callback The callback to invoke.
 */
function canShip(details, shippingOptions, callback) {
  let selectedShippingOption;
  for (let i in shippingOptions) {
    if (shippingOptions[i].selected) {
      selectedShippingOption = shippingOptions[i];
    }
  }

  let subtotal = 0.50;
  let total = subtotal;
  if (selectedShippingOption) {
    let shippingPrice = Number(selectedShippingOption.amount.value);
    total = subtotal + shippingPrice;
  }

  details.shippingOptions = shippingOptions;
  details.total = {
    label: 'Total',
    amount: {currency: 'USD', value: total.toFixed(2)},
  };
  details.displayItems = [
    {
      label: 'Sub-total',
      amount: {currency: 'USD', value: subtotal.toFixed(2)},
    },
  ];
  if (selectedShippingOption) {
    details.displayItems.splice(0, 0, selectedShippingOption);
  }

  callback(details);
}

/**
 * Converts the payment instrument into a dictionary.
 *
 * @private
 * @param {PaymentResponse} instrument The instrument to convert.
 * @return {object} The dictionary representation of the instrument.
 */
function instrumentToDictionary(instrument) {
  let details = instrument.details;
  if ('cardNumber' in details) {
    details.cardNumber = 'XXXX-XXXX-XXXX-' + details.cardNumber.substr(12);
  }

  if ('cardSecurityCode' in details) {
    details.cardSecurityCode = '***';
  }

  return {
    methodName: instrument.methodName,
    details: details,
    shippingAddress: addressToDictionary(instrument.shippingAddress),
    shippingOption: instrument.shippingOption,
    payerName: instrument.payerName,
    payerPhone: instrument.payerPhone,
    payerEmail: instrument.payerEmail,
  };
}

/**
 * Converts the payment instrument into a JSON string.
 *
 * @private
 * @param {PaymentResponse} instrument The instrument to convert.
 * @return {string} The string representation of the instrument.
 */
function instrumentToJsonString(instrument) {
  /* PaymentResponse is an interface, but JSON.stringify works only on
   * dictionaries. */
  return JSON.stringify(instrumentToDictionary(instrument), undefined, 2);
}

/**
 * Simulates credit card processing without talking to the server.
 *
 * @private
 * @param {PaymentResponse} instrument The credit card information to simulate
 * processing.
 */
function simulateCreditCardProcessing(instrument) {
  let simulationTimeout = window.setTimeout(function() {
    window.clearTimeout(simulationTimeout);
    instrument.complete('success').then(function() {
      print(instrumentToJsonString(instrument));
      print('Simulated credit card authorization');
    }).catch(function(error) {
      print(error);
    });
  }, 5 * 1000);  /* +5 seconds to simulate server latency. */
}

/**
 * Converts the shipping address into a dictionary.
 *
 * @private
 * @param {PaymentAddress} address The address to convert.
 * @return {object} The dictionary with address data.
 */
function addressToDictionary(address) {
  if (address.toJSON) {
    return address.toJSON();
  }
  return {
    recipient: address.recipient,
    organization: address.organization,
    addressLine: address.addressLine,
    dependentLocality: address.dependentLocality,
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    sortingCode: address.sortingCode,
    country: address.country,
    phone: address.phone,
  };
}

/**
 * Converts the shipping address into a JSON string.
 *
 * @private
 * @param {PaymentAddress} address The address to convert.
 * @return {string} The string representation of the address.
 */
function addressToJsonString(address) {
  return JSON.stringify(addressToDictionary(address), undefined, 2);
}

/**
 * Authorizes user's Android Pay for USD $0.50 plus shipping. Simulates credit
 * card processing without talking to the server.
 */
function buy() { // eslint-disable-line no-unused-vars
  document.getElementById('msg').innerHTML = '';

  if (!window.PaymentRequest) {
    print('Web payments are not supported in this browser');
    return;
  }

  let details = {
    total: {label: 'Total', amount: {currency: 'USD', value: '0.50'}},
  };

  let networks = ['visa', 'mastercard', 'amex', 'discover', 'diners', 'jcb',
      'unionpay', 'mir'];
  let payment = new PaymentRequest( // eslint-disable-line no-undef
    [
      {
        supportedMethods: ['https://android.com/pay'],
        data: {
          merchantName: 'Web Payments Demo',
          allowedCardNetworks: ['AMEX', 'MASTERCARD', 'VISA', 'DISCOVER'],
          merchantId: '00184145120947117657',
          paymentMethodTokenizationParameters: {
            tokenizationType: 'GATEWAY_TOKEN',
            parameters: {
              'gateway': 'stripe',
              'stripe:publishableKey': 'pk_live_lNk21zqKM2BENZENh3rzCUgo',
              'stripe:version': '2016-07-06',
            },
          },
        },
      },
      {
        supportedMethods: networks,
      },
      {
        supportedMethods: ['basic-card'],
        data: {
          supportedNetworks: networks,
          supportedTypes: ['debit', 'credit', 'prepaid'],
        },
      },
      
    ],
    details,
    {
      requestShipping: true,
      requestPayerName: true,
      requestPayerPhone: true,
      requestPayerEmail: true,
      shippingType: 'shipping',
    });

  payment.addEventListener('shippingaddresschange', function(evt) {
    evt.updateWith(new Promise(function(resolve) {
      fetch('/ship', {
        method: 'POST',
        headers: new Headers({'Content-Type': 'application/json'}),
        body: addressToJsonString(payment.shippingAddress),
      })
      .then(function(options) {
        if (options.ok) {
          return options.json();
        }
        cannotShip('Unable to calculate shipping options.', details,
            resolve);
      })
      .then(function(optionsJson) {
        if (optionsJson.status === 'success') {
          canShip(details, optionsJson.shippingOptions, resolve);
        } else {
          cannotShip('Unable to calculate shipping options.', details,
              resolve);
        }
      })
      .catch(function(error) {
        cannotShip('Unable to calculate shipping options. ' + error, details,
            resolve);
      });
    }));
  });

  payment.addEventListener('shippingoptionchange', function(evt) {
    evt.updateWith(new Promise(function(resolve) {
      for (let i in details.shippingOptions) {
        if ({}.hasOwnProperty.call(details.shippingOptions, i)) {
          details.shippingOptions[i].selected =
              (details.shippingOptions[i].id === payment.shippingOption);
        }
      }

      canShip(details, details.shippingOptions, resolve);
    }));
  });

  let paymentTimeout = window.setTimeout(function() {
    window.clearTimeout(paymentTimeout);
    payment.abort().then(function() {
      print('Payment timed out after 20 minutes.');
    }).catch(function() {
      print('Unable to abort, because the user is currently in the process ' +
          'of paying.');
    });
  }, 20 * 60 * 1000);  /* 20 minutes */

  payment.show()
  .then(function(instrument) {
    window.clearTimeout(paymentTimeout);

    if (instrument.methodName !== 'https://android.com/pay') {
      simulateCreditCardProcessing(instrument);
      return;
    }

    let instrumentObject = instrumentToDictionary(instrument);
    instrumentObject.total = details.total;
    let instrumentString = JSON.stringify(instrumentObject, undefined, 2);
    fetch('/buy', {
      method: 'POST',
      headers: new Headers({'Content-Type': 'application/json'}),
      body: instrumentString,
    })
    .then(function(buyResult) {
      if (buyResult.ok) {
        return buyResult.json();
      }
      complete(instrument, 'fail', 'Error sending instrument to server.');
    }).then(function(buyResultJson) {
      print(instrumentString);
      complete(instrument, buyResultJson.status, buyResultJson.message);
    });
  })
  .catch(function(error) {
    print('Could not charge user. ' + error);
  });
}
