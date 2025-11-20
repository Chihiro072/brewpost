using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Stripe;
using Stripe.Checkout;
using System.Collections.Generic;

namespace BrewPost.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StripeController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public StripeController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public class CreateCheckoutSessionRequest
        {
            public string? Plan { get; set; } // "basic" | "pro" | "unlimited"
        }

        [HttpPost("create-checkout-session")]
        public IActionResult CreateCheckoutSession([FromBody] CreateCheckoutSessionRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.Plan))
                {
                    return BadRequest(new { error = "plan_required" });
                }

                var stripeSecret = _configuration["STRIPE_SECRET_KEY"] ?? _configuration["Stripe:SecretKey"];
                if (string.IsNullOrWhiteSpace(stripeSecret))
                {
                    return StatusCode(500, new { error = "stripe_not_configured", detail = "Set STRIPE_SECRET_KEY environment variable" });
                }
                StripeConfiguration.ApiKey = stripeSecret;

                // Map plan to price ID from configuration (optional)
                var priceBasic = _configuration["STRIPE_PRICE_BASIC"] ?? _configuration["Stripe:PriceBasic"];
                var pricePro = _configuration["STRIPE_PRICE_PRO"] ?? _configuration["Stripe:PricePro"];
                var priceUnlimited = _configuration["STRIPE_PRICE_UNLIMITED"] ?? _configuration["Stripe:PriceUnlimited"];

                string planKey = request.Plan.ToLowerInvariant();
                string planName = planKey switch
                {
                    "basic" => "Basic Plan",
                    "pro" => "Pro Plan",
                    "unlimited" => "Unlimited Plan",
                    _ => "Plan"
                };
                long amount = planKey switch
                {
                    "basic" => 900,
                    "pro" => 1900,
                    "unlimited" => 2900,
                    _ => 900
                };

                string? priceId = planKey switch
                {
                    "basic" => priceBasic,
                    "pro" => pricePro,
                    "unlimited" => priceUnlimited,
                    _ => null
                };

                // Determine frontend URL for success/cancel
                var frontendBase = _configuration["FRONTEND_BASE_URL"]
                    ?? _configuration["Frontend:BaseUrl"]
                    ?? "http://localhost:5173";

                var service = new SessionService();
                var baseUrl = (frontendBase ?? "http://localhost:5173").TrimEnd('/');
                var baseWithSlash = baseUrl.EndsWith("/") ? baseUrl : baseUrl + "/";
                var successUrl = new System.Uri(new System.Uri(baseWithSlash), $"payment-success?plan={planKey}&session_id={{CHECKOUT_SESSION_ID}}").ToString();
                var cancelUrl = new System.Uri(new System.Uri(baseWithSlash), "settings?checkout=cancel").ToString();
                var options = new SessionCreateOptions
                {
                    Mode = "subscription",
                    UiMode = "hosted", // ensure hosted checkout returns session.url
                    Locale = "en",
                    PaymentMethodTypes = new List<string> { "card" },
                    LineItems = new List<SessionLineItemOptions>(),
                    SuccessUrl = successUrl,
                    CancelUrl = cancelUrl,
                };

                if (!string.IsNullOrWhiteSpace(priceId))
                {
                    options.LineItems.Add(new SessionLineItemOptions
                    {
                        Price = priceId,
                        Quantity = 1,
                    });
                }
                else
                {
                    options.LineItems.Add(new SessionLineItemOptions
                    {
                        Quantity = 1,
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = "usd",
                            UnitAmount = amount,
                            Recurring = new SessionLineItemPriceDataRecurringOptions
                            {
                                Interval = "month"
                            },
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = planName
                            }
                        }
                    });
                }

                var session = service.Create(options);

                // Fallback: if url is missing, refetch session
                if (string.IsNullOrEmpty(session.Url))
                {
                    try
                    {
                        var fetched = service.Get(session.Id);
                        if (!string.IsNullOrEmpty(fetched.Url))
                        {
                            session = fetched;
                        }
                    }
                    catch (StripeException)
                    {
                        // ignore and return without url
                    }
                }

                // Log for debugging
                System.Console.WriteLine($"[Stripe] Created session: id={session.Id}, url={(session.Url ?? "<null>")}");

                // Ensure frontend receives camelCase keys
                return Ok(new { sessionId = session.Id, url = session.Url ?? string.Empty });
            }
            catch (StripeException sex)
            {
                return StatusCode(500, new { error = "stripe_error", detail = sex.Message });
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, new { error = "server_error", detail = ex.Message });
            }
        }
    }
}