// src/rmsLanding/LandingPage.jsx
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  
  // Check if user is already logged in, if so redirect to dashboard
  useEffect(() => {
    const token = localStorage.getItem('token');
    const restaurant = JSON.parse(localStorage.getItem('restaurant') || '{}');
    
    if (token && restaurant.id) {
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="nav-bar">
        <div className="nav-container">
          <div className="nav-logo">
            <h1>SRMS</h1>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#pricing">Pricing</a>
            <a href="#testimonials">Testimonials</a>
            <a href="#faq">FAQ</a>
            <Link to="/login" className="nav-btn login-btn">Login</Link>
            <Link to="/signup" className="nav-btn signup-btn">Sign Up</Link>
          </div>
          <div className="mobile-menu-button">
            <i className="fas fa-bars"></i>
          </div>
        </div>
        
        {/* Mobile menu */}
        <div className="mobile-menu">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#pricing">Pricing</a>
          <a href="#testimonials">Testimonials</a>
          <a href="#faq">FAQ</a>
          <Link to="/login">Login</Link>
          <Link to="/signup" className="mobile-signup">Sign Up</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1>Smart Restaurant Management <span>Simplified</span></h1>
            <p>
              A comprehensive MERN stack solution designed to streamline your restaurant operations, boost efficiency, and increase profits.
            </p>
            <div className="hero-buttons">
              <Link to="/signup" className="primary-btn">Get Started Free</Link>
              <a href="#features" className="secondary-btn">Explore Features</a>
            </div>
          </div>
          <div className="hero-image">
            <img src="/restaurant-dashboard.png" alt="Restaurant Dashboard Preview" />
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header">
            <h2>Powerful Features for Modern Restaurants</h2>
            <p>
              SRMS combines all the tools you need to manage your restaurant efficiently in one easy-to-use platform.
            </p>
          </div>

          <div className="features-grid">
            {/* Feature 1 */}
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-utensils"></i>
              </div>
              <h3>Order Management</h3>
              <p>
                Streamline your order process from kitchen to table with real-time updates and status tracking. Reduce errors and speed up service.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-chair"></i>
              </div>
              <h3>Table Management</h3>
              <p>
                Optimize seating arrangements, reduce wait times, and improve customer flow. Generate QR codes for contactless ordering.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-chart-line"></i>
              </div>
              <h3>Analytics Dashboard</h3>
              <p>
                Gain valuable insights into your restaurant's performance with comprehensive analytics and reporting tools.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-calendar-alt"></i>
              </div>
              <h3>Reservation System</h3>
              <p>
                Allow customers to book tables online and manage your reservations efficiently to maximize capacity.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-warehouse"></i>
              </div>
              <h3>Inventory Management</h3>
              <p>
                Track ingredients, manage suppliers, and reduce waste with our intelligent inventory tracking system.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-user-friends"></i>
              </div>
              <h3>Staff Management</h3>
              <p>
                Schedule shifts, track performance, and manage your team all from one central dashboard with role-based access.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="container">
          <div className="section-header">
            <h2>How SRMS Works</h2>
            <p>
              Our MERN stack solution is designed to be intuitive, powerful, and adaptable to your restaurant's unique needs.
            </p>
          </div>

          <div className="steps-container">
            {/* Step 1 */}
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Sign Up</h3>
              <p>
                Create your account and set up your restaurant profile with menu items and table layouts.
              </p>
            </div>

            {/* Arrow */}
            <div className="step-arrow">
              <i className="fas fa-long-arrow-alt-right"></i>
            </div>

            {/* Step 2 */}
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Customize</h3>
              <p>
                Configure the system to match your workflow and integrate with your existing tools and processes.
              </p>
            </div>

            {/* Arrow */}
            <div className="step-arrow">
              <i className="fas fa-long-arrow-alt-right"></i>
            </div>

            {/* Step 3 */}
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Manage & Grow</h3>
              <p>
                Use real-time insights to optimize operations, reduce costs, and increase customer satisfaction.
              </p>
            </div>
          </div>
          
          <div className="start-journey">
            <Link to="/signup" className="primary-btn">Start Your Journey</Link>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">500+</div>
              <div className="stat-label">Restaurants Served</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">15M+</div>
              <div className="stat-label">Orders Processed</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">98%</div>
              <div className="stat-label">Customer Satisfaction</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">30%</div>
              <div className="stat-label">Average Profit Increase</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing-section">
        <div className="container">
          <div className="section-header">
            <h2>Simple, Transparent Pricing</h2>
            <p>
              Choose the plan that fits your restaurant's size and needs. All plans include our core features.
            </p>
          </div>

          <div className="pricing-grid">
            {/* Starter Plan */}
            <div className="pricing-card">
              <div className="pricing-header">
                <h3>Starter</h3>
                <p>For small restaurants</p>
                <div className="price">$49<span>/month</span></div>
              </div>
              <div className="pricing-features">
                <ul>
                  <li>Up to 10 tables</li>
                  <li>Basic analytics</li>
                  <li>Order management</li>
                  <li>Email support</li>
                </ul>
                <Link to="/signup" className="pricing-btn">Get Started</Link>
              </div>
            </div>

            {/* Professional Plan */}
            <div className="pricing-card featured">
              <div className="pricing-header">
                <h3>Professional</h3>
                <p>For growing restaurants</p>
                <div className="price">$99<span>/month</span></div>
              </div>
              <div className="pricing-features">
                <ul>
                  <li>Up to 30 tables</li>
                  <li>Advanced analytics</li>
                  <li>Reservation system</li>
                  <li>Priority support</li>
                  <li>Staff management</li>
                </ul>
                <Link to="/signup" className="pricing-btn featured-btn">Get Started</Link>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="pricing-card">
              <div className="pricing-header">
                <h3>Enterprise</h3>
                <p>For restaurant chains</p>
                <div className="price">$249<span>/month</span></div>
              </div>
              <div className="pricing-features">
                <ul>
                  <li>Unlimited tables</li>
                  <li>Multi-location support</li>
                  <li>Custom integrations</li>
                  <li>24/7 dedicated support</li>
                  <li>White-label options</li>
                </ul>
                <Link to="/signup" className="pricing-btn">Contact Sales</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="testimonials-section">
        <div className="container">
          <div className="section-header">
            <h2>Trusted by Restaurant Owners</h2>
            <p>
              See what our customers are saying about how SRMS has transformed their businesses.
            </p>
          </div>

          <div className="testimonials-grid">
            {/* Testimonial 1 */}
            <div className="testimonial-card">
              <div className="testimonial-stars">
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
              </div>
              <p>
                "SRMS has completely transformed how we manage orders. Our kitchen efficiency has improved by 30% and customer wait times have decreased significantly."
              </p>
              <div className="testimonial-author">
                <img src="/testimonial1.jpg" alt="Customer" />
                <div>
                  <h4>Michael Chen</h4>
                  <p>Owner, Fusion Bistro</p>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="testimonial-card">
              <div className="testimonial-stars">
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
              </div>
              <p>
                "The analytics dashboard has given us insights we never had before. We've been able to optimize our menu and increase our profit margins by 15% in just three months."
              </p>
              <div className="testimonial-author">
                <img src="/testimonial2.jpg" alt="Customer" />
                <div>
                  <h4>Sarah Johnson</h4>
                  <p>Manager, The Urban Plate</p>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="testimonial-card">
              <div className="testimonial-stars">
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star"></i>
                <i className="fas fa-star-half-alt"></i>
              </div>
              <p>
                "As a multi-location restaurant chain, SRMS has made it possible to maintain consistent operations across all our locations. The support team has been exceptional."
              </p>
              <div className="testimonial-author">
                <img src="/testimonial3.jpg" alt="Customer" />
                <div>
                  <h4>David Rodriguez</h4>
                  <p>CEO, Fresh Bites Chain</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="faq-section">
        <div className="container">
          <div className="section-header">
            <h2>Frequently Asked Questions</h2>
            <p>
              Find answers to common questions about SRMS.
            </p>
          </div>

          <div className="faq-container">
            {/* Question 1 */}
            <div className="faq-item">
              <h3>How easy is it to set up SRMS?</h3>
              <p>
                Setting up SRMS is straightforward. Our team will guide you through the process, which typically takes less than a day. We can also import your existing data to make the transition seamless.
              </p>
            </div>

            {/* Question 2 */}
            <div className="faq-item">
              <h3>Do I need technical knowledge to use SRMS?</h3>
              <p>
                No technical knowledge is required. SRMS is designed with an intuitive interface that anyone can use. We also provide comprehensive training and 24/7 support.
              </p>
            </div>

            {/* Question 3 */}
            <div className="faq-item">
              <h3>Can SRMS integrate with my existing POS system?</h3>
              <p>
                Yes, SRMS integrates with most popular POS systems. Our Professional and Enterprise plans include integration options for seamless data flow between systems.
              </p>
            </div>

            {/* Question 4 */}
            <div className="faq-item">
              <h3>Is there a contract or can I pay month-to-month?</h3>
              <p>
                We offer both monthly and annual billing options. Annual billing comes with a 20% discount. There are no long-term contracts required, and you can cancel anytime.
              </p>
            </div>

            {/* Question 5 */}
            <div className="faq-item">
              <h3>How secure is my restaurant data?</h3>
              <p>
                Security is our priority. SRMS uses industry-standard encryption and secure server infrastructure. Your data is backed up regularly and protected by multiple security measures.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <h2>Ready to Transform Your Restaurant?</h2>
          <p>
            Join thousands of restaurants already using SRMS to streamline operations and increase profits.
          </p>
          <div className="cta-buttons">
            <Link to="/signup" className="primary-btn">Start Free Trial</Link>
            <a href="#features" className="secondary-btn">Learn More</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            {/* Company Info */}
            <div className="footer-column">
              <h3>SRMS</h3>
              <p>
                Modern restaurant management solution built with the MERN stack.
              </p>
              <div className="social-icons">
                <a href="#"><i className="fab fa-facebook-f"></i></a>
                <a href="#"><i className="fab fa-twitter"></i></a>
                <a href="#"><i className="fab fa-instagram"></i></a>
                <a href="#"><i className="fab fa-linkedin-in"></i></a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="footer-column">
              <h3>Quick Links</h3>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#testimonials">Testimonials</a></li>
                <li><a href="#faq">FAQ</a></li>
                <li><a href="#">Blog</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div className="footer-column">
              <h3>Resources</h3>
              <ul>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">API Reference</a></li>
                <li><a href="#">Knowledge Base</a></li>
                <li><a href="#">Community</a></li>
                <li><a href="#">Support</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div className="footer-column">
              <h3>Contact Us</h3>
              <ul className="contact-info">
                <li>
                  <i className="fas fa-envelope"></i>
                  <a href="mailto:info@srms.com">info@srms.com</a>
                </li>
                <li>
                  <i className="fas fa-phone"></i>
                  <a href="tel:+1234567890">+1 (234) 567-890</a>
                </li>
                <li>
                  <i className="fas fa-map-marker-alt"></i>
                  <span>123 Tech Street, San Francisco, CA</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>
              &copy; 2025 SRMS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;