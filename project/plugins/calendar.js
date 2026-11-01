const fetchPath = 'db.json';
fetch(fetchPath, { method: 'GET' })
    .then(response => 
      response.json()
    )
    .then(json => 
      console.log(json);
    );
