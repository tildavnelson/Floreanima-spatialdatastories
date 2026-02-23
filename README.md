# Flore Anima 


Flore Anima is an interactive animation website built with React and Vite that visualises the natural patterns of plants and fungi through the months in France.

## What is it?
The main page displays 12 animated tiles showing the top 12 plant and fungi species photographed and submitted to iNaturalist in France throughout the months of the year. Each tile cycles through real observation photographs, creating a living, patterned animation of the French landscape.

![Screenshot 2026-02-23 144908](https://github.com/user-attachments/assets/885d047e-c22b-46e1-9647-3757e6c6aa49)

Using the slider at the bottom you can move through the months of the year, watching the species and colours of the landscape shift with the seasons.

Clicking on a tile opens a full viewer that animates through all available photographs of that species for that month, creating a patterned portrait of a single species in its seasonal context.

![Screenshot 2026-02-23 144753](https://github.com/user-attachments/assets/80647841-f420-436e-a2e6-2ead9bb208d7)


## Data
All observation data and photographs are sourced live from the iNaturalist API — a citizen science platform where people submit wildlife observations from around the world. iNaturalist can be found at www.inaturalist.org.
The API is queried using the following parameters:

Location: France (place_id: 6753)

Taxa: Plantae and Fungi

Ranked by: number of observations with photographs for the selected month

Ordered by: most voted observations first
