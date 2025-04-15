// Select elements
const fetchButton = document.getElementById("fetch-button");
const dataContainer = document.getElementById("data");

// Fetch data from an API and update the DOM
fetchButton.addEventListener("click", () => {
    // Show loading message
    dataContainer.innerHTML = "Loading data...";

    // Fetch data from a public API
    fetch("https://jsonplaceholder.typicode.com/posts/1")
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            // Update DOM with fetched data
            dataContainer.innerHTML = `
                <h3>${data.title}</h3>
                <p>${data.body}</p>
            `;
        })
        .catch(error => {
            // Show error message
            dataContainer.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        });
});
