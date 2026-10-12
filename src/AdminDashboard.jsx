
import { useEffect, useState } from "react";

import { API } from "./apiConfig";

function AdminDashboard({ user, onLogout }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch(
          `${API}/admin/dashboard?adminUserId=${user.id}`
        );

        if (!response.ok) {
          throw new Error("Unable to load admin dashboard.");
        }

        const data = await response.json();
        setDashboard(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [user.id]);

  if (loading) {
    return <div className="dashboard"><p>Loading dashboard...</p></div>;
  }

  if (error) {
    return (
      <div className="dashboard">
        <h2>Admin Dashboard</h2>
        <p>{error}</p>
        <button onClick={onLogout}>Logout</button>
      </div>
    );
  }

  if (!dashboard) {
    return <p>No dashboard data available.</p>;
  }

  const customers = dashboard.customers || [];
  const providers = dashboard.providers || [];
  const requests = dashboard.requests || [];

  const completed = requests.filter(
    (request) => request.status === "COMPLETED"
  ).length;

  const onlineProviders = providers.filter(
    (provider) => provider.online === true
  ).length;

  return (
    <div className="dashboard admin-dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Quick Fix Admin</h1>
          <p>Monitor customers, providers and service requests.</p>
        </div>
        <button onClick={onLogout}>Logout</button>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <h3>Total Customers</h3>
          <p>{customers.length}</p>
        </div>

        <div className="stat-card">
          <h3>Total Providers</h3>
          <p>{providers.length}</p>
        </div>

        <div className="stat-card">
          <h3>Online Providers</h3>
          <p>{onlineProviders}</p>
        </div>

        <div className="stat-card">
          <h3>Total Requests</h3>
          <p>{requests.length}</p>
        </div>

        <div className="stat-card">
          <h3>Completed Jobs</h3>
          <p>{completed}</p>
        </div>
      </section>

      <section className="admin-section">
        <h2>Customer Details</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.id}</td>
                  <td>{customer.name}</td>
                  <td>{customer.email}</td>
                  <td>{customer.phone || "-"}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan="4">No customers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2>Service Provider Details</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>City</th>
                <th>Pincode</th>
                <th>Availability</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id}>
                  <td>{provider.id}</td>
                  <td>{provider.name}</td>
                  <td>{provider.email}</td>
                  <td>{provider.city || "-"}</td>
                  <td>{provider.pincode || "-"}</td>
                  <td>{provider.online ? "Online" : "Offline"}</td>
                </tr>
              ))}
              {providers.length === 0 && (
                <tr><td colSpan="6">No providers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2>All Service Requests</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Category</th>
                <th>City</th>
                <th>Pincode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.id}</td>
                  <td>{request.categoryName || request.category || "-"}</td>
                  <td>{request.city || "-"}</td>
                  <td>{request.pincode || "-"}</td>
                  <td>{request.status}</td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr><td colSpan="5">No service requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;
